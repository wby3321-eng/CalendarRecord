import { useEffect, useState } from "react";
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
  { value: "lane", label: "顶部时间条 + 卡片", hint: "跨天任务在顶部以横条展示，超出条数的转为卡片" },
  { value: "card", label: "全部转为卡片", hint: "不画顶部横条，所有跨天任务都作为卡片显示" },
];

const EMPTY_DAY_OPTIONS: { value: EmptyDayStyle; label: string; hint: string }[] = [
  { value: "dim", label: "仅视觉弱化（不改尺寸）", hint: "无任务日期底色变浅、日期变淡，格子大小不变" },
  { value: "shrink", label: "缩小格子高度", hint: "无任务日期收缩为紧凑一行，点击即可新增任务" },
];

function RadioCards<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition ${
            value === opt.value ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            name={name}
            className="mt-0.5 accent-brand-600"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>
            <span className="block text-[13px] font-medium text-slate-700">{opt.label}</span>
            <span className="block text-[11px] text-slate-400 leading-snug">{opt.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      {children}
    </section>
  );
}

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-cardlg animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 shrink-0 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />

            <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">⚙️ 偏好设置</h2>
                <p className="mt-0.5 text-[12px] text-slate-400">日历展示与提醒规则</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                title="关闭"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
              <Section title="卡片展示方式">
                <RadioCards name="cr-display-mode" options={DISPLAY_OPTIONS} value={displayMode} onChange={setDisplayMode} />
              </Section>

              <Section title="跨天任务展示">
                <RadioCards name="cr-gantt-mode" options={GANTT_OPTIONS} value={ganttMode} onChange={setGanttMode} />
                {ganttMode === "lane" && (
                  <label className="mt-2 flex items-center gap-2 text-[13px] text-slate-600">
                    最多保留
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={ganttLanes}
                      onChange={(e) => setGanttLanes(Number(e.target.value))}
                      className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                    行横条，超出转卡片
                  </label>
                )}
              </Section>

              <Section title="无任务日期">
                <RadioCards name="cr-empty-day" options={EMPTY_DAY_OPTIONS} value={emptyDayStyle} onChange={setEmptyDayStyle} />
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">今天始终强调显示，不受此项影响。</p>
              </Section>

              <Section title="延期阈值">
                <label className="flex items-center gap-2 text-[13px] text-slate-600">
                  改期达
                  <input
                    type="number"
                    min={1}
                    value={threshold}
                    onChange={(e) => setThreshold(Math.max(1, Number(e.target.value)))}
                    className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                  次且未完成时高亮
                </label>
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">超过计划完成日未完成也会高亮。</p>
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
