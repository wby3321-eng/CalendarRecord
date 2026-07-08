import { useEffect, useRef, useState } from "react";
import type { CardDisplayMode, EmptyDayStyle, GanttMode } from "../types";

interface Props {
  threshold: number;
  setThreshold: (n: number) => void;
  displayMode: CardDisplayMode;
  setDisplayMode: (m: CardDisplayMode) => void;
  ganttMode: GanttMode;
  setGanttMode: (m: GanttMode) => void;
  ganttLanes: number;
  setGanttLanes: (n: number) => void;
  emptyDayStyle: EmptyDayStyle;
  setEmptyDayStyle: (s: EmptyDayStyle) => void;
}

const DISPLAY_OPTIONS: { value: CardDisplayMode; label: string; hint: string }[] = [
  { value: "default", label: "默认（白底左边框）", hint: "白色卡片，左侧类型色边框" },
  { value: "typeColor", label: "类型色深浅", hint: "底色随类型色 · 待办深、进行中变浅、完成最浅" },
];

const GANTT_OPTIONS: { value: GanttMode; label: string; hint: string }[] = [
  { value: "lane", label: "泳道甘特条 + 卡片", hint: "跨天任务顶部泳道条展示，超出条数的转为带甘特标志的卡片" },
  { value: "card", label: "全部卡片（标甘特）", hint: "不画泳道条，所有跨天任务都作为带甘特标志的卡片" },
];

const EMPTY_DAY_OPTIONS: { value: EmptyDayStyle; label: string; hint: string }[] = [
  { value: "dim", label: "仅视觉弱化（不改尺寸）", hint: "无任务日期底色变浅、日期变淡，格子大小不变" },
  { value: "shrink", label: "缩小格子高度", hint: "无任务日期收缩为紧凑一行，点击即可新增任务" },
];

export default function Settings({
  threshold,
  setThreshold,
  displayMode,
  setDisplayMode,
  ganttMode,
  setGanttMode,
  ganttLanes,
  setGanttLanes,
  emptyDayStyle,
  setEmptyDayStyle,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="偏好设置"
        className={`border rounded-lg px-3 py-1.5 transition ${
          open
            ? "border-brand-500 bg-brand-50 text-brand-700"
            : "border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        ⚙️ 设置
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-cardlg p-4 z-40 text-left">
          <div className="text-sm font-bold text-slate-700 mb-3">偏好设置</div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">卡片展示方式</div>
            <div className="flex flex-col gap-1.5">
              {DISPLAY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition ${
                    displayMode === opt.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cr-display-mode"
                    className="mt-0.5 accent-brand-600"
                    checked={displayMode === opt.value}
                    onChange={() => setDisplayMode(opt.value)}
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-700">{opt.label}</span>
                    <span className="block text-[11px] text-slate-400 leading-snug">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">跨天任务（甘特）展示</div>
            <div className="flex flex-col gap-1.5">
              {GANTT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition ${
                    ganttMode === opt.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cr-gantt-mode"
                    className="mt-0.5 accent-brand-600"
                    checked={ganttMode === opt.value}
                    onChange={() => setGanttMode(opt.value)}
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-700">{opt.label}</span>
                    <span className="block text-[11px] text-slate-400 leading-snug">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {ganttMode === "lane" && (
              <label className="mt-2 flex items-center gap-2 text-[13px] text-slate-600">
                最多保留
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={ganttLanes}
                  onChange={(e) => setGanttLanes(Number(e.target.value))}
                  className="w-14 border border-slate-200 rounded px-1.5 py-1 text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                条泳道，超出转卡片
              </label>
            )}
          </div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">无任务日期</div>
            <div className="flex flex-col gap-1.5">
              {EMPTY_DAY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition ${
                    emptyDayStyle === opt.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cr-empty-day"
                    className="mt-0.5 accent-brand-600"
                    checked={emptyDayStyle === opt.value}
                    onChange={() => setEmptyDayStyle(opt.value)}
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-700">{opt.label}</span>
                    <span className="block text-[11px] text-slate-400 leading-snug">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">今天始终强调显示，不受此项影响。</p>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">延期阈值</div>
            <label className="flex items-center gap-2 text-[13px] text-slate-600">
              改期达
              <input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(1, Number(e.target.value)))}
                className="w-14 border border-slate-200 rounded px-1.5 py-1 text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              次且未完成时高亮
            </label>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">超过计划完成日未完成也会高亮。</p>
          </div>
        </div>
      )}
    </div>
  );
}
