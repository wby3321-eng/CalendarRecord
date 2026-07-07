from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import TaskType, User
from ..schemas import TaskTypeIn, TaskTypeOut, TaskTypeUpdate

router = APIRouter(prefix="/api/types", tags=["types"])


def _get_owned_type(type_id: int, user: User, db: Session) -> TaskType:
    t = db.get(TaskType, type_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "类型不存在")
    if t.is_builtin and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "内置类型不可修改")
    if not t.is_builtin and t.owner_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权操作该类型")
    return t


@router.get("", response_model=list[TaskTypeOut])
def list_types(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 内置类型（全局）+ 本人自定义类型；管理员可见全部
    if user.role == "admin":
        stmt = select(TaskType)
    else:
        stmt = select(TaskType).where(
            or_(TaskType.is_builtin == True, TaskType.owner_id == user.id)  # noqa: E712
        )
    return list(db.scalars(stmt.order_by(TaskType.is_builtin.desc(), TaskType.id)))


@router.post("", response_model=TaskTypeOut)
def create_type(payload: TaskTypeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = TaskType(
        owner_id=user.id,
        name=payload.name,
        color=payload.color,
        icon=payload.icon,
        is_builtin=False,
        field_defs=[fd.model_dump() for fd in payload.field_defs],
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/{type_id}", response_model=TaskTypeOut)
def update_type(type_id: int, payload: TaskTypeUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_owned_type(type_id, user, db)
    data = payload.model_dump(exclude_unset=True)
    if "field_defs" in data and data["field_defs"] is not None:
        data["field_defs"] = [fd if isinstance(fd, dict) else fd.model_dump() for fd in payload.field_defs]
    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{type_id}")
def delete_type(type_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_owned_type(type_id, user, db)
    if t.is_builtin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "内置类型不可删除")
    # 其下任务的 type_id 由外键 SET NULL 处理（任务保留，变为未分类）
    db.delete(t)
    db.commit()
    return {"ok": True}
