from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------- Auth ----------
class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    nickname: str = Field(default="", max_length=32)


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    nickname: str
    role: str
    created_at: datetime
    updated_at: datetime


class UpdateMeIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=32)


# ---------- Field defs ----------
class FieldDef(BaseModel):
    key: str
    label: str
    type: str  # text / link / image / file / textarea


# ---------- Task Types ----------
class TaskTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    color: str = "#3b82f6"
    icon: str = "tag"
    field_defs: list[FieldDef] = []


class TaskTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=32)
    color: str | None = None
    icon: str | None = None
    field_defs: list[FieldDef] | None = None


class TaskTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int | None
    name: str
    color: str
    icon: str
    is_builtin: bool
    field_defs: list


# ---------- Attachments ----------
class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int
    kind: str
    url: str
    filename: str
    size: int

    @model_validator(mode="after")
    def _build_download_url(self):
        # DB 中 url 列存物理文件名，对外统一暴露受保护下载地址
        self.url = f"/api/files/{self.id}"
        return self


# ---------- Tasks ----------
class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type_id: int | None = None
    link: str = ""
    conclusion: str = ""
    status: str = "todo"
    priority: str = "medium"
    plan_start_date: date | None = None
    plan_due_date: date | None = None
    ext_fields: dict = {}


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    type_id: int | None = None
    link: str | None = None
    conclusion: str | None = None
    status: str | None = None
    priority: str | None = None
    plan_start_date: date | None = None
    plan_due_date: date | None = None
    ext_fields: dict | None = None


class TaskDrag(BaseModel):
    mode: str  # body / left / right
    plan_start_date: date | None = None
    plan_due_date: date | None = None


class TaskStatusIn(BaseModel):
    status: str  # todo / in-progress / done


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int
    type_id: int | None
    title: str
    link: str
    conclusion: str
    status: str
    priority: str
    created_at: datetime
    plan_start_date: date
    plan_due_date: date
    actual_done_at: datetime | None
    reschedule_count: int
    ext_fields: dict
    updated_at: datetime
    attachments: list[AttachmentOut] = []
