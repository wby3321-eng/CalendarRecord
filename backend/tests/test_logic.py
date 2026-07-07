from datetime import date

import pytest

from app.logic import (
    apply_drag,
    build_date_range,
    can_register,
    cycle_status,
    is_delayed,
    parse_search,
    truncate_conclusion,
)


# UT-01 延期判断双条件
def test_is_delayed_overdue():
    assert is_delayed("todo", 0, date(2026, 7, 1), date(2026, 7, 3)) is True


def test_is_delayed_by_threshold():
    assert is_delayed("in-progress", 3, date(2026, 8, 1), date(2026, 7, 3), threshold=3) is True


def test_not_delayed_when_done():
    assert is_delayed("done", 5, date(2026, 1, 1), date(2026, 7, 3)) is False


def test_not_delayed_when_within():
    assert is_delayed("todo", 1, date(2026, 8, 1), date(2026, 7, 3), threshold=3) is False


# UT-02 搜索解析
def test_parse_search_tokens():
    r = parse_search("status:done type:plan 读源码")
    assert r["statuses"] == ["done"]
    assert r["types"] == ["plan"]
    assert r["text"] == "读源码"


def test_parse_search_multi_status_union():
    r = parse_search("status:done status:todo")
    assert r["statuses"] == ["done", "todo"]


def test_parse_search_empty():
    r = parse_search("")
    assert r == {"statuses": [], "types": [], "text": ""}


# UT-03 拖拽主体
def test_drag_body_forward_increments():
    start, due, delta = apply_drag("body", date(2026, 7, 1), date(2026, 7, 3), date(2026, 7, 4), date(2026, 7, 6))
    assert (start, due, delta) == (date(2026, 7, 4), date(2026, 7, 6), 1)


def test_drag_body_backward_no_increment():
    start, due, delta = apply_drag("body", date(2026, 7, 5), date(2026, 7, 7), date(2026, 7, 2), date(2026, 7, 4))
    assert delta == 0


# UT-04 拖拽边缘
def test_drag_right_only_due():
    start, due, delta = apply_drag("right", date(2026, 7, 1), date(2026, 7, 3), None, date(2026, 7, 8))
    assert (start, due, delta) == (date(2026, 7, 1), date(2026, 7, 8), 0)


def test_drag_left_only_start():
    start, due, delta = apply_drag("left", date(2026, 7, 3), date(2026, 7, 6), date(2026, 7, 1), None)
    assert (start, due, delta) == (date(2026, 7, 1), date(2026, 7, 6), 0)


# UT-05 视图范围
def test_build_range_week_monday_first():
    # 2026-07-03 是周五
    start, end = build_date_range("week", date(2026, 7, 3))
    assert start == date(2026, 6, 29)  # 周一
    assert end == date(2026, 7, 5)  # 周日
    assert (end - start).days == 6


def test_build_range_month_grid_aligned():
    start, end = build_date_range("month", date(2026, 7, 15))
    assert start.weekday() == 0  # 周一
    assert end.weekday() == 6  # 周日
    assert start <= date(2026, 7, 1) and end >= date(2026, 7, 31)


def test_build_range_custom_invalid():
    with pytest.raises(ValueError):
        build_date_range("custom", date(2026, 7, 1), date(2026, 7, 10), date(2026, 7, 1))


# UT-07 注册限流
def test_can_register():
    assert can_register(4, 5) is True
    assert can_register(5, 5) is False


# UT-08 结论截断
def test_truncate_conclusion():
    assert truncate_conclusion("a" * 25) == "a" * 20
    assert truncate_conclusion("短结论") == "短结论"
    assert truncate_conclusion("") == ""


# UT-10 状态循环
def test_cycle_status_forward():
    assert cycle_status("todo") == "in-progress"
    assert cycle_status("in-progress") == "done"
    assert cycle_status("done") == "todo"


def test_cycle_status_backward():
    assert cycle_status("done", "backward") == "in-progress"
    assert cycle_status("todo", "backward") == "done"
