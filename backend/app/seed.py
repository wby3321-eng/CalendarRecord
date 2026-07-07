from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import TaskType, User
from .security import hash_password

BUILTIN_TYPES = [
    {"name": "计划", "color": "#3b82f6", "icon": "target"},
    {"name": "TODO", "color": "#f59e0b", "icon": "check-square"},
    {"name": "idea", "color": "#8b5cf6", "icon": "lightbulb"},
    {"name": "reading", "color": "#10b981", "icon": "book-open"},
    {"name": "收藏", "color": "#ec4899", "icon": "star"},
]


def seed(db: Session) -> None:
    # 预置管理员
    admin = db.scalar(select(User).where(User.username == settings.ADMIN_USERNAME))
    if admin is None:
        admin = User(
            username=settings.ADMIN_USERNAME,
            nickname="管理员",
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)

    # 预置内置类型（全局，owner_id=NULL）
    existing = db.scalar(select(TaskType).where(TaskType.is_builtin == True))  # noqa: E712
    if existing is None:
        for t in BUILTIN_TYPES:
            db.add(
                TaskType(
                    owner_id=None,
                    name=t["name"],
                    color=t["color"],
                    icon=t["icon"],
                    is_builtin=True,
                    field_defs=[],
                )
            )
    db.commit()
