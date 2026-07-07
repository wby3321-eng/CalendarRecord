from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# 状态：todo / in-progress / done（可逆序切换）
# 优先级：high / medium / low


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)  # 登录账号，不可改
    nickname: Mapped[str] = mapped_column(String, default="")  # 显示昵称，可改
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="user")  # user / admin
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class TaskType(Base):
    __tablename__ = "task_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )  # 内置类型 owner_id=NULL，全局可见
    name: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String, default="#3b82f6")
    icon: Mapped[str] = mapped_column(String, default="tag")
    is_builtin: Mapped[bool] = mapped_column(default=False)
    field_defs: Mapped[list] = mapped_column(JSON, default=list)  # [{key,label,type}]
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type_id: Mapped[int | None] = mapped_column(
        ForeignKey("task_types.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String)
    link: Mapped[str] = mapped_column(String, default="")
    conclusion: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="todo", index=True)
    priority: Mapped[str] = mapped_column(String, default="medium")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    plan_start_date: Mapped[date] = mapped_column(Date, index=True)
    plan_due_date: Mapped[date] = mapped_column(Date, index=True)
    actual_done_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0)
    ext_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String, default="file")  # image / file
    url: Mapped[str] = mapped_column(String)
    filename: Mapped[str] = mapped_column(String)
    size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    task: Mapped["Task"] = relationship(back_populates="attachments")
