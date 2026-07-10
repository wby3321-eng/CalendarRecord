"""纯业务逻辑函数，隔离 DB/网络/浏览器，便于单元测试（UT-01~UT-10）。"""
from datetime import date, timedelta

STATUSES = ["todo", "in-progress", "done"]
DEFAULT_THRESHOLD = 3


def is_delayed(status: str, reschedule_count: int, plan_due_date: date, today: date, threshold: int = DEFAULT_THRESHOLD) -> bool:
    """延期高亮双条件：未完成 且 (超期 或 改期次数≥阈值)。"""
    if status == "done":
        return False
    overdue = today > plan_due_date
    too_many_reschedules = reschedule_count >= threshold
    return overdue or too_many_reschedules


def parse_search(query: str) -> dict:
    """解析类 GitHub 搜索语法：status:done type:plan tag:公司 关键词。

    多个同名 token 取并集；剩余文本作为模糊匹配项。
    返回 {"statuses": [...], "types": [...], "tags": [...], "text": "..."}。
    """
    statuses: list[str] = []
    types: list[str] = []
    tags: list[str] = []
    text_parts: list[str] = []

    for token in (query or "").split():
        if token.startswith("status:") and len(token) > 7:
            statuses.append(token[7:])
        elif token.startswith("type:") and len(token) > 5:
            types.append(token[5:])
        elif token.startswith("tag:") and len(token) > 4:
            tags.append(token[4:])
        else:
            text_parts.append(token)

    return {
        "statuses": statuses,
        "types": types,
        "tags": tags,
        "text": " ".join(text_parts).strip(),
    }


def apply_drag(mode: str, old_start: date, old_due: date, new_start: date | None, new_due: date | None):
    """拖拽三语义，返回 (start, due, reschedule_delta)。

    - body：整体平移，向后移则 reschedule_delta=1。
    - left：只改开始日，不计延期。
    - right：只改计划完成日，不计延期。
    """
    if mode == "body":
        start = new_start if new_start is not None else old_start
        due = new_due if new_due is not None else old_due
        delta = 1 if start > old_start else 0
        return start, due, delta
    if mode == "left":
        start = new_start if new_start is not None else old_start
        return start, old_due, 0
    if mode == "right":
        due = new_due if new_due is not None else old_due
        return old_start, due, 0
    raise ValueError(f"未知拖拽模式: {mode}")


def build_date_range(view: str, anchor: date, custom_start: date | None = None, custom_end: date | None = None):
    """按视图返回 (start, end) 查询范围，周一为首。

    - week：锚点所在周的周一 .. 周日（7 天）。
    - month：覆盖整月的网格（对齐到周一/周日）。
    - custom：给定起止；起>止抛异常。
    """
    if view == "week":
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=6)
    if view == "month":
        first = anchor.replace(day=1)
        if first.month == 12:
            next_first = first.replace(year=first.year + 1, month=1)
        else:
            next_first = first.replace(month=first.month + 1)
        last = next_first - timedelta(days=1)
        grid_start = first - timedelta(days=first.weekday())
        grid_end = last + timedelta(days=(6 - last.weekday()))
        return grid_start, grid_end
    if view == "custom":
        if custom_start is None or custom_end is None:
            raise ValueError("自定义视图需提供起止日期")
        if custom_start > custom_end:
            raise ValueError("起始日期不能晚于结束日期")
        return custom_start, custom_end
    raise ValueError(f"未知视图: {view}")


def truncate_conclusion(text: str, n: int = 20) -> str:
    """结论预览：超过 n 字截断为前 n 字（不加省略号，由前端呈现）。"""
    if not text:
        return ""
    return text if len(text) <= n else text[:n]


def cycle_status(current: str, direction: str = "forward") -> str:
    """状态循环切换，支持正向与逆序。"""
    idx = STATUSES.index(current)
    if direction == "forward":
        return STATUSES[(idx + 1) % len(STATUSES)]
    return STATUSES[(idx - 1) % len(STATUSES)]


def can_register(user_count: int, max_users: int = 5) -> bool:
    """注册限流：用户数 < 上限时允许。"""
    return user_count < max_users
