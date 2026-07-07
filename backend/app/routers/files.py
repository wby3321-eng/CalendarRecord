import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Attachment, Task, User
from ..schemas import AttachmentOut

router = APIRouter(prefix="/api/files", tags=["files"])

MAX_SIZE = 20 * 1024 * 1024  # 20MB


def _owned_task(task_id: int, user: User, db: Session) -> Task:
    t = db.get(Task, task_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "任务不存在")
    if t.owner_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权操作该任务")
    return t


def _owned_attachment(attachment_id: int, user: User, db: Session) -> Attachment:
    att = db.get(Attachment, attachment_id)
    if att is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "附件不存在")
    task = db.get(Task, att.task_id)
    if task is None or (task.owner_id != user.id and user.role != "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权访问该附件")
    return att


@router.post("/upload", response_model=AttachmentOut)
async def upload(
    task_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_task(task_id, user, db)

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "文件过大（上限 20MB）")

    ext = os.path.splitext(file.filename or "")[1]
    stored = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, stored)
    with open(path, "wb") as f:
        f.write(data)

    kind = "image" if (file.content_type or "").startswith("image/") else "file"
    att = Attachment(
        task_id=task_id,
        kind=kind,
        url=stored,  # 存物理文件名，下载端点据此定位；对外经 schema 暴露为 /api/files/{id}
        filename=file.filename or stored,
        size=len(data),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.get("/{attachment_id}")
def download(attachment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    att = _owned_attachment(attachment_id, user, db)
    path = os.path.join(settings.UPLOAD_DIR, att.url)
    if not os.path.exists(path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文件已丢失")
    return FileResponse(path, filename=att.filename)


@router.delete("/{attachment_id}")
def delete_attachment(attachment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    att = _owned_attachment(attachment_id, user, db)
    path = os.path.join(settings.UPLOAD_DIR, att.url)
    if os.path.exists(path):
        os.remove(path)
    db.delete(att)
    db.commit()
    return {"ok": True}
