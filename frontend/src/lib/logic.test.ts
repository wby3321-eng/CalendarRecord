import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import {
  cycleStatus,
  isDelayed,
  parseSearch,
  truncateConclusion,
} from "./logic";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    owner_id: 1,
    type_id: 1,
    title: "任务",
    link: "",
    conclusion: "",
    status: "todo",
    priority: "medium",
    created_at: "2026-01-01",
    plan_start_date: "2999-01-01",
    plan_due_date: "2999-01-01",
    actual_done_at: null,
    reschedule_count: 0,
    ext_fields: {},
    updated_at: "2026-01-01",
    attachments: [],
    ...overrides,
  };
}

describe("isDelayed", () => {
  it("已完成任务永不高亮", () => {
    expect(isDelayed(makeTask({ status: "done", plan_due_date: "2000-01-01" }))).toBe(false);
    expect(isDelayed(makeTask({ status: "done", reschedule_count: 99 }))).toBe(false);
  });

  it("未完成且超期高亮", () => {
    expect(isDelayed(makeTask({ status: "todo", plan_due_date: "2000-01-01" }))).toBe(true);
  });

  it("未完成且改期次数达到阈值高亮", () => {
    expect(isDelayed(makeTask({ reschedule_count: 3 }), 3)).toBe(true);
    expect(isDelayed(makeTask({ reschedule_count: 2 }), 3)).toBe(false);
  });

  it("未超期且改期不足阈值不高亮", () => {
    expect(isDelayed(makeTask({ plan_due_date: "2999-01-01", reschedule_count: 1 }))).toBe(false);
  });
});

describe("truncateConclusion", () => {
  it("空文本返回空", () => {
    expect(truncateConclusion("")).toBe("");
  });

  it("不超过 n 字原样返回", () => {
    expect(truncateConclusion("短结论")).toBe("短结论");
  });

  it("超过 n 字截断为前 n 字", () => {
    const text = "一".repeat(30);
    expect(truncateConclusion(text, 20)).toBe("一".repeat(20));
  });
});

describe("cycleStatus", () => {
  it("正向循环 todo→in-progress→done→todo", () => {
    expect(cycleStatus("todo")).toBe("in-progress");
    expect(cycleStatus("in-progress")).toBe("done");
    expect(cycleStatus("done")).toBe("todo");
  });

  it("逆向循环可回退", () => {
    expect(cycleStatus("todo", "backward")).toBe("done");
    expect(cycleStatus("done", "backward")).toBe("in-progress");
  });
});

describe("parseSearch", () => {
  it("解析 status 与 type token 及关键词", () => {
    const r = parseSearch("status:done type:计划 复盘 报告");
    expect(r.statuses).toEqual(["done"]);
    expect(r.types).toEqual(["计划"]);
    expect(r.text).toBe("复盘 报告");
  });

  it("支持多个同类 token", () => {
    const r = parseSearch("status:todo status:in-progress");
    expect(r.statuses).toEqual(["todo", "in-progress"]);
    expect(r.text).toBe("");
  });

  it("纯关键词无 token", () => {
    const r = parseSearch("季度总结");
    expect(r.statuses).toEqual([]);
    expect(r.types).toEqual([]);
    expect(r.text).toBe("季度总结");
  });

  it("解析 tag token", () => {
    const r = parseSearch("tag:公司A tag:重点 复盘");
    expect(r.tags).toEqual(["公司A", "重点"]);
    expect(r.text).toBe("复盘");
  });

  it("空查询返回空结构", () => {
    const r = parseSearch("");
    expect(r).toEqual({ statuses: [], types: [], tags: [], text: "" });
  });
});
