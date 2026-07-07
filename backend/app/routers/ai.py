import json
from datetime import date

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..logic import build_date_range, parse_search
from ..models import Task, TaskType, User

router = APIRouter(prefix="/api/ai", tags=["ai"])

MAX_CONTEXT_TASKS = 200

PRESETS = {
    "trend": {
        "label": "进度趋势",
        "prompt": "分析这些任务的整体进度趋势：完成率、进行中占比、延期情况随时间的变化，给出关键结论。",
    },
    "distribution": {
        "label": "分布分析",
        "prompt": "分析任务在类型、状态、优先级上的分布，指出资源投入的偏向与失衡点。",
    },
    "review": {
        "label": "阶段性复盘",
        "prompt": "作为复盘教练，总结这段时间的成果与收获（结论字段）、暴露的问题（延期/积压），并给出改进建议。",
    },
    "forecast": {
        "label": "预测报告",
        "prompt": "基于历史完成节奏与当前积压，预测后续完成情况与潜在风险，给出可执行建议。",
    },
}


class AnalyzeIn(BaseModel):
    preset: str | None = None
    prompt: str | None = None
    view: str | None = None
    anchor: date | None = None
    custom_start: date | None = None
    custom_end: date | None = None
    q: str | None = None
    owner_id: int | None = None


@router.get("/presets")
def list_presets():
    return [{"key": k, "label": v["label"], "prompt": v["prompt"]} for k, v in PRESETS.items()]


def _query_context_tasks(payload: AnalyzeIn, user: User, db: Session) -> list[Task]:
    stmt = select(Task)
    if user.role == "admin":
        if payload.owner_id is not None:
            stmt = stmt.where(Task.owner_id == payload.owner_id)
    else:
        stmt = stmt.where(Task.owner_id == user.id)

    if payload.view:
        start, end = build_date_range(payload.view, payload.anchor or date.today(), payload.custom_start, payload.custom_end)
        stmt = stmt.where(Task.plan_start_date <= end, Task.plan_due_date >= start)

    if payload.q:
        parsed = parse_search(payload.q)
        if parsed["statuses"]:
            stmt = stmt.where(Task.status.in_(parsed["statuses"]))
        if parsed["text"]:
            like = f"%{parsed['text']}%"
            stmt = stmt.where(or_(Task.title.like(like), Task.link.like(like), Task.conclusion.like(like)))

    stmt = stmt.order_by(Task.plan_start_date).limit(MAX_CONTEXT_TASKS)
    return list(db.scalars(stmt))


def _build_context(tasks: list[Task], type_map: dict[int, str]) -> str:
    lines = []
    for t in tasks:
        lines.append(
            json.dumps(
                {
                    "title": t.title,
                    "type": type_map.get(t.type_id, ""),
                    "status": t.status,
                    "priority": t.priority,
                    "start": str(t.plan_start_date),
                    "due": str(t.plan_due_date),
                    "done_at": str(t.actual_done_at) if t.actual_done_at else None,
                    "reschedule": t.reschedule_count,
                    "conclusion": (t.conclusion or "")[:100],
                },
                ensure_ascii=False,
            )
        )
    return "\n".join(lines)


@router.post("/analyze")
def analyze(payload: AnalyzeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tasks = _query_context_tasks(payload, user, db)
    type_map = {t.id: t.name for t in db.scalars(select(TaskType))}
    context = _build_context(tasks, type_map)

    instruction = payload.prompt
    if payload.preset and payload.preset in PRESETS:
        instruction = PRESETS[payload.preset]["prompt"]
    if not instruction:
        instruction = "请分析以下任务数据并给出结论。"

    messages = [
        {"role": "system", "content": "你是个人成长数据分析助手，基于用户任务数据给出简洁、有洞察、可执行的中文分析。使用 Markdown 输出。"},
        {"role": "user", "content": f"{instruction}\n\n任务数据（每行一个 JSON，共{len(tasks)}条）：\n{context or '（无数据）'}"},
    ]

    async def event_stream():
        if not settings.GLM_API_KEY or settings.GLM_API_KEY.startswith("REPLACE_"):
            yield "data: " + json.dumps({"delta": "⚠️ 未配置智谱 API Key，无法调用真实模型。请在后端 config.py 或环境变量 GLM_API_KEY 中配置。"}, ensure_ascii=False) + "\n\n"
            yield "data: [DONE]\n\n"
            return

        url = f"{settings.GLM_BASE_URL}/chat/completions"
        headers = {"Authorization": f"Bearer {settings.GLM_API_KEY}", "Content-Type": "application/json"}
        body = {"model": settings.GLM_MODEL, "messages": messages, "stream": True, "temperature": 0.6}
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", url, headers=headers, json=body) as resp:
                    if resp.status_code != 200:
                        detail = (await resp.aread()).decode("utf-8", "ignore")
                        yield "data: " + json.dumps({"delta": f"模型调用失败（{resp.status_code}）：{detail[:300]}"}, ensure_ascii=False) + "\n\n"
                        yield "data: [DONE]\n\n"
                        return
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield "data: " + json.dumps({"delta": delta}, ensure_ascii=False) + "\n\n"
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
            yield "data: [DONE]\n\n"
        except httpx.HTTPError as e:
            yield "data: " + json.dumps({"delta": f"网络错误：{e}"}, ensure_ascii=False) + "\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
