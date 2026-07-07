from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from .config import settings
from .database import get_db
from .models import User
from .security import decode_access_token


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录")

    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "登录状态失效")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "需要管理员权限")
    return user


def scope_by_owner(stmt: Select, model, user: User, target_owner_id: int | None = None) -> Select:
    """强制按 owner 过滤，杜绝越权。

    - 普通用户：只能看自己的数据。
    - 管理员：默认看全部；可通过 target_owner_id 指定切换查看某个用户。
    """
    if user.role == "admin":
        if target_owner_id is not None:
            return stmt.where(model.owner_id == target_owner_id)
        return stmt  # 管理员聚合查看全部
    return stmt.where(model.owner_id == user.id)
