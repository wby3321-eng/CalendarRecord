import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
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
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [editingNick, setEditingNick] = useState(false);
  const [nick, setNick] = useState(user?.nickname || "");
  const [savingNick, setSavingNick] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // 打开面板 / 用户变化时同步昵称草稿，退出编辑态
  useEffect(() => {
    setNick(user?.nickname || "");
    setEditingNick(false);
  }, [open, user?.nickname]);

  const isAdmin = user?.role === "admin";
  const displayName = user?.nickname || user?.username || "";
  const initial = displayName.slice(0, 1).toUpperCase();

  const saveNick = async () => {
    const v = nick.trim();
    if (!v || v === user?.nickname) {
      setEditingNick(false);
      setNick(user?.nickname || "");
      return;
    }
    setSavingNick(true);
    try {
      const u = await api.updateMe(v);
      setUser(u);
      setEditingNick(false);
    } catch {
      /* 保存失败保留编辑态 */
    } finally {
      setSavingNick(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="账户与偏好设置"
        className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition ${
          open ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-100"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-[13px] font-bold text-white">
          {initial}
        </span>
        <span className="max-w-[120px] truncate text-[13px] font-medium text-slate-700">{displayName}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 flex max-h-[calc(100vh-5rem)] w-[min(92vw,384px)] origin-top-right flex-col overflow-hidden rounded-2xl bg-white shadow-cardlg ring-1 ring-black/5 animate-pop">
          {/* 账户：头像 + 昵称（可就地修改） */}
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-lg font-bold text-white shadow-card">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              {editingNick ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nick}
                    disabled={savingNick}
                    maxLength={20}
                    onChange={(e) => setNick(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveNick();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingNick(false);
                        setNick(user?.nickname || "");
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-brand-300 px-2 py-1 text-sm font-semibold text-slate-800 outline-none ring-2 ring-brand-100"
                    placeholder="输入昵称"
                  />
                  <button
                    onClick={saveNick}
                    disabled={savingNick}
                    title="保存"
                    className="shrink-0 rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold text-slate-800">{displayName}</span>
                  <button
                    onClick={() => setEditingNick(true)}
                    title="修改昵称"
                    className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="mt-0.5 truncate text-xs text-slate-400">
                @{user?.username} · {isAdmin ? "管理员" : "用户"}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
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
      )}
    </div>
  );
}
