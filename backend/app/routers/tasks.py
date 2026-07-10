from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..logic import STATUSES, apply_drag, build_date_range, parse_search
from ..models import Task, TaskType, User
from ..schemas import TaskDrag, TaskIn, TaskOut, TaskStatusIn, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_owned_task(task_id: int, user: User, db: Session) -> Task:
    t = db.get(Task, task_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "任务不存在")
    if t.owner_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权操作该任务")
    return t


def _resolve_type_ids(tokens: list[str], user: User, db: Session) -> list[int]:
    if not tokens:
        return []
    stmt = select(TaskType)
    if user.role != "admin":
        stmt = stmt.where(or_(TaskType.is_builtin == True, TaskType.owner_id == user.id))  # noqa: E712
    ids: list[int] = []
    all_types = list(db.scalars(stmt))
    for tok in tokens:
        low = tok.lower()
        for t in all_types:
            if low == t.name.lower() or low in t.name.lower():
                ids.append(t.id)
    return ids


@router.get("", response_model=list[TaskOut])
def list_tasks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    view: str | None = Query(default=None),
    anchor: date | None = Query(default=None),
    custom_start: date | None = Query(default=None),
    custom_end: date | None = Query(default=None),
    q: str | None = Query(default=None),
    owner_id: int | None = Query(default=None),  # 管理员切换查看某用户
):
    stmt = select(Task).options(selectinload(Task.attachments))

    # owner 隔离
    if user.role == "admin":
        if owner_id is not None:
            stmt = stmt.where(Task.owner_id == owner_id)
    else:
        stmt = stmt.where(Task.owner_id == user.id)

    # 视图范围：跨天任务只要与范围相交即纳入
    if view:
        start, end = build_date_range(view, anchor or date.today(), custom_start, custom_end)
        stmt = stmt.where(Task.plan_start_date <= end, Task.plan_due_date >= start)

    # 搜索：status:xxx type:xxx tag:xxx + 模糊文本
    parsed = parse_search(q) if q else None
    if parsed:
        if parsed["statuses"]:
            stmt = stmt.where(Task.status.in_(parsed["statuses"]))
        if parsed["types"]:
            type_ids = _resolve_type_ids(parsed["types"], user, db)
            stmt = stmt.where(Task.type_id.in_(type_ids or [-1]))
        if parsed["text"]:
            like = f"%{parsed['text']}%"
            stmt = stmt.where(
                or_(Task.title.like(like), Task.link.like(like), Task.conclusion.like(like))
            )

    stmt = stmt.order_by(Task.plan_start_date, Task.id)
    rows = list(db.scalars(stmt))

    # tag 存于 ext_fields["tags"]（JSON 数组），在 Python 侧做不区分大小写的子串匹配（任一命中即纳入）
    if parsed and parsed["tags"]:
        wanted = [t.lower() for t in parsed["tags"]]
        rows = [r for r in rows if _task_has_tag(r, wanted)]

    return rows


def _task_has_tag(task: Task, wanted: list[str]) -> bool:
    raw = (task.ext_fields or {}).get("tags") or []
    if not isinstance(raw, list):
        return False
    have = [str(t).lower() for t in raw]
    return any(any(w in h for h in have) for w in wanted)


@router.post("", response_model=TaskOut)
def create_task(payload: TaskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    start = payload.plan_start_date or today
    due = payload.plan_due_date or start
    if due < start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "计划完成日不能早于开始日")
    if payload.status not in STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "非法状态")

    t = Task(
        owner_id=user.id,
        type_id=payload.type_id,
        title=payload.title,
        link=payload.link,
        conclusion=payload.conclusion,
        status=payload.status,
        priority=payload.priority,
        plan_start_date=start,
        plan_due_date=due,
        ext_fields=payload.ext_fields,
        actual_done_at=datetime.now() if payload.status == "done" else None,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned_task(task_id, user, db)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_owned_task(task_id, user, db)
    data = payload.model_dump(exclude_unset=True)

    if "status" in data:
        if data["status"] not in STATUSES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "非法状态")
        t.actual_done_at = datetime.now() if data["status"] == "done" else None

    for k, v in data.items():
        setattr(t, k, v)

    if t.plan_due_date < t.plan_start_date:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "计划完成日不能早于开始日")

    db.commit()
    db.refresh(t)
    return t


@router.post("/{task_id}/status", response_model=TaskOut)
def set_status(task_id: int, payload: TaskStatusIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_owned_task(task_id, user, db)
    if payload.status not in STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "非法状态")
    t.status = payload.status
    t.actual_done_at = datetime.now() if payload.status == "done" else None
    db.commit()
    db.refresh(t)
    return t


@router.post("/{task_id}/drag", response_model=TaskOut)
def drag_task(task_id: int, payload: TaskDrag, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_owned_task(task_id, user, db)
    start, due, delta = apply_drag(
        payload.mode, t.plan_start_date, t.plan_due_date, payload.plan_start_date, payload.plan_due_date
    )
    if due < start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "计划完成日不能早于开始日")
    t.plan_start_date = start
    t.plan_due_date = due
    t.reschedule_count += delta
    db.commit()
    db.refresh(t)
    return t


@router.post("/{task_id}/reset-reschedule", response_model=TaskOut)
def reset_reschedule(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_owned_task(task_id, user, db)
    t.reschedule_count = 0
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{task_id}")
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_owned_task(task_id, user, db)
    db.delete(t)
    db.commit()
    return {"ok": True}
