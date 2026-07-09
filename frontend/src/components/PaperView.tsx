import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Priority, Status, Task, TaskType } from "../types";
import { dayjs, WEEK_LABELS } from "../lib/date";
import { getDayMark } from "../lib/holidays";
import { isDelayed, PRIORITY_LABEL, STATUS_LABEL, typeEmoji } from "../lib/logic";

interface Props {
  date: string;
  tasks: Task[];
  types: TaskType[];
  threshold: number;
  ownerMap?: Record<number, string>;
  onOpenTask: (t: Task) => void;
  onAdd: () => void;
  onClose: () => void;
}

// 徽章配色对齐主界面 TaskCard / 任务详情 TaskDrawer，保留各字段自己的图标与颜色
const PILL = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold";

const STATUS_DOT: Record<Status, string> = {
  todo: "bg-slate-400",
  "in-progress": "bg-amber-500",
  done: "bg-emerald-500",
};

const STATUS_PILL: Record<Status, string> = {
  todo: "bg-slate-100 text-slate-600",
  "in-progress": "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
};

const PRIORITY_PILL: Record<Priority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-sky-100 text-sky-700",
};

const orderKey = (date: string) => `cr_paper_order_${date}`;

function loadOrder(date: string): number[] {
  try {
    const raw = localStorage.getItem(orderKey(date));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

/** 合并已存排布与最新任务：保留已有顺序、剔除已删任务、新任务补末尾。顺序不变时返回原引用以避免重渲染。 */
function reconcile(prev: number[], tasks: Task[]): number[] {
  const ids = tasks.map((t) => t.id);
  const idSet = new Set(ids);
  const kept = prev.filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  const next = [...kept, ...ids.filter((id) => !keptSet.has(id))];
  if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
  return next;
}

export default function PaperView({ date, tasks, types, threshold, ownerMap, onOpenTask, onAdd, onClose }: Props) {
  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const [order, setOrder] = useState<number[]>(() => reconcile(loadOrder(date), tasks));
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  useEffect(() => setOrder((prev) => reconcile(prev, tasks)), [tasks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const persist = (next: number[]) => {
    try {
      localStorage.setItem(orderKey(date), JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  };

  const swap = (a: number, b: number) => {
    if (a === b) return;
    setOrder((prev) => {
      const next = [...prev];
      const ia = next.indexOf(a);
      const ib = next.indexOf(b);
      if (ia < 0 || ib < 0) return prev;
      [next[ia], next[ib]] = [next[ib], next[ia]];
      persist(next);
      return next;
    });
  };

  const dj = dayjs(date);
  const mark = getDayMark(date);
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const rate = total ? Math.round((doneCount / total) * 100) : 0;

  const ordered = order.map((id) => taskMap.get(id)).filter((t): t is Task => !!t);

  const dragProps = (task: Task) => ({
    draggable: true,
    onDragStart: () => setDragId(task.id),
    onDragEnter: () => setOverId(task.id),
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragLeave: () => setOverId((cur) => (cur === task.id ? null : cur)),
    onDrop: () => {
      if (dragId != null) swap(dragId, task.id);
      setDragId(null);
      setOverId(null);
    },
    onDragEnd: () => {
      setDragId(null);
      setOverId(null);
    },
    onClick: () => onOpenTask(task),
  });

  const dragCls = (id: number) =>
    `${dragId === id ? "scale-[0.98] opacity-40" : ""} ${overId === id ? "ring-2 ring-brand-400" : ""}`;

  // 不规则版面：CSS Grid + JS 行跨度实现瀑布式 masonry；头条整幅、重点内容加宽为双栏。
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  const layoutMasonry = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cs = getComputedStyle(grid);
    const rowUnit = parseFloat(cs.gridAutoRows) || 8;
    const rowGap = parseFloat(cs.rowGap) || 0;
    const items = Array.from(grid.children) as HTMLElement[];
    // 先归零行跨度，用 scrollHeight 读取被裁剪前的自然内容高度（auto-rows 固定，offsetHeight 会被夹住）
    items.forEach((el) => (el.style.gridRowEnd = "auto"));
    const heights = items.map((el) => el.scrollHeight);
    items.forEach((el, i) => {
      const span = Math.max(1, Math.ceil((heights[i] + rowGap) / (rowUnit + rowGap)));
      el.style.gridRowEnd = `span ${span}`;
    });
  }, []);

  useLayoutEffect(() => layoutMasonry());

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const ro = new ResizeObserver(() => {
      const w = grid.clientWidth;
      const next = w >= 820 ? 3 : w >= 520 ? 2 : 1;
      setCols((c) => (c === next ? c : next));
      layoutMasonry();
    });
    ro.observe(grid);
    return () => ro.disconnect();
  }, [layoutMasonry]);

  const typeOf = (task: Task) => (task.type_id != null ? typeMap.get(task.type_id) : undefined);
  const colorOf = (task: Task) => typeOf(task)?.color || "#94a3b8";

  // 头条占满整行；其余按「内容重点 + 位置节奏」错落加宽 → 参差的杂志式 bento 版面
  const colSpan = (task: Task, index: number) => {
    if (index === 0) return cols;
    if (cols === 1) return 1;
    const restIdx = index - 1;
    const rich = (task.conclusion?.length ?? 0) > 90 || task.priority === "high";
    const rhythmWide = cols === 3 && restIdx % 3 === 0;
    return rich || rhythmWide ? 2 : 1;
  };

  const Tags = ({ task }: { task: Task }) => {
    const type = typeOf(task);
    const tColor = type?.color || "#94a3b8";
    const delayed = isDelayed(task, threshold);
    const owner = ownerMap?.[task.owner_id];
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={PILL} style={{ color: tColor, backgroundColor: `${tColor}1a` }}>
          <span className="text-[12px] leading-none">{typeEmoji(type?.icon)}</span>
          {type?.name || "未分类"}
        </span>
        <span className={`${PILL} ${STATUS_PILL[task.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
          {STATUS_LABEL[task.status]}
        </span>
        <span className={`${PILL} ${PRIORITY_PILL[task.priority]}`}>{PRIORITY_LABEL[task.priority]}优先级</span>
        {delayed && (
          <span className={`${PILL} bg-red-50 text-red-600`}>
            ⏭️ 已延期{task.reschedule_count > 0 ? ` ${task.reschedule_count} 次` : ""}
          </span>
        )}
        {owner && <span className={`${PILL} bg-slate-400 text-white`}>@{owner}</span>}
        {task.link && (
          <a
            href={task.link}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className={`${PILL} bg-slate-100 text-brand-600 hover:bg-brand-50`}
            title="打开链接"
          >
            🔗 链接
          </a>
        )}
      </div>
    );
  };

  const RING = 30;
  const CIRC = 2 * Math.PI * RING;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-cardlg animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 报头：现代杂志风 —— 左侧大字日期 + 品牌 eyebrow，右侧完成度圆环 */}
        <div className="relative shrink-0 border-b border-slate-100 bg-white px-8 pt-6 pb-5">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 text-xl leading-none text-slate-300 transition hover:text-slate-600"
            title="关闭（Esc）"
          >
            ✕
          </button>
          <div className="flex items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.32em] text-brand-500">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
                Daily Review
              </div>
              <h1 className="flex items-baseline gap-3 leading-none">
                <span className="text-[40px] font-black tracking-tight text-slate-900 sm:text-5xl">
                  {dj.format("M月D日")}
                </span>
                <span className="text-lg font-medium text-slate-400">星期{WEEK_LABELS[dj.isoWeekday() - 1]}</span>
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span>{dj.format("YYYY 年")} · 成长日报</span>
                {mark?.type === "holiday" && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-500">🎉 {mark.label}</span>
                )}
                {mark?.type === "makeup" && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600">🗓️ 调休上班</span>
                )}
              </div>
            </div>

            {total > 0 && (
              <div className="relative shrink-0" title={`已完成 ${doneCount} / ${total}`}>
                <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
                  <circle cx="38" cy="38" r={RING} fill="none" stroke="#e2e8f0" strokeWidth="7" />
                  <circle
                    cx="38"
                    cy="38"
                    r={RING}
                    fill="none"
                    stroke="url(#paperDonut)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - rate / 100)}
                    className="transition-[stroke-dashoffset] duration-500"
                  />
                  <defs>
                    <linearGradient id="paperDonut" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black leading-none text-slate-900">{rate}%</span>
                  <span className="mt-0.5 text-[10px] font-semibold text-slate-400">
                    {doneCount}/{total}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 版面 */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl">📰</div>
              <div className="mt-4 text-lg font-bold text-slate-500">今日暂无记事</div>
              <div className="mt-1 text-sm text-slate-400">记录今天的计划、想法与收获</div>
              <button
                onClick={onAdd}
                className="mt-5 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700"
              >
                ＋ 撰写一条
              </button>
            </div>
          ) : (
            <>
              {total > 1 && (
                <div className="mb-4 text-center text-[11px] text-slate-400">
                  ⇄ 拖动任一板块到另一板块可对调版面 · 单击板块可编辑内容
                </div>
              )}

              <div
                ref={gridRef}
                className="grid gap-5"
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gridAutoRows: "8px",
                  gridAutoFlow: "row dense",
                }}
              >
                {ordered.map((task, i) => {
                  const feature = i === 0;
                  const done = task.status === "done";
                  return (
                    <article
                      key={task.id}
                      {...dragProps(task)}
                      style={{
                        gridColumn: `span ${colSpan(task, i)}`,
                        borderLeftWidth: "3px",
                        borderLeftColor: colorOf(task),
                      }}
                      className={`group relative cursor-move overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition hover:shadow-cardmd ${
                        feature ? "p-6" : "p-4"
                      } ${dragCls(task.id)}`}
                    >
                      {feature && (
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300">
                          头条 · Top Story
                        </div>
                      )}
                      {feature ? (
                        <h2
                          className={`text-2xl font-bold leading-snug sm:text-[26px] ${
                            done ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {task.title}
                        </h2>
                      ) : (
                        <h3
                          className={`text-base font-bold leading-snug ${
                            done ? "text-slate-400 line-through" : "text-slate-800"
                          }`}
                        >
                          {task.title}
                        </h3>
                      )}
                      {task.conclusion && (
                        <p
                          className={`whitespace-pre-line text-slate-500 ${
                            feature
                              ? "mt-3 text-[15px] leading-7 text-slate-600 line-clamp-6"
                              : "mt-2 text-sm leading-6 line-clamp-5"
                          }`}
                        >
                          {done ? "✅ " : ""}
                          {task.conclusion}
                        </p>
                      )}
                      <Tags task={task} />
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
