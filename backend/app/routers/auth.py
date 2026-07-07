from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import User
from ..schemas import LoginIn, RegisterIn, UpdateMeIn, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        path="/",
    )


@router.post("/register", response_model=UserOut)
def register(payload: RegisterIn, response: Response, db: Session = Depends(get_db)):
    # 注册限流：用户总数 < MAX_USERS
    count = db.scalar(select(func.count()).select_from(User))
    if count >= settings.MAX_USERS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "注册人数已达上限，禁止注册")

    exists = db.scalar(select(User).where(User.username == payload.username))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已存在")

    user = User(
        username=payload.username,
        nickname=payload.nickname or payload.username,
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _set_cookie(response, create_access_token(user.id))
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")

    _set_cookie(response, create_access_token(user.id))
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(settings.COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """管理员专属：列出全部用户，供切换查看/聚合选择。"""
    return db.scalars(select(User).order_by(User.id)).all()


@router.patch("/me", response_model=UserOut)
def update_me(payload: UpdateMeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.nickname = payload.nickname
    db.commit()
    db.refresh(user)
    return user
