import { useEffect, useMemo, useState } from "react";
import type { Status, Task, TaskType } from "../types";
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

const STATUS_BADGE: Record<Status, string> = {
  todo: "bg-slate-100 text-slate-600",
  "in-progress": "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
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
  const headline = ordered[0];
  const rest = ordered.slice(1);
  const colClass =
    rest.length <= 1 ? "columns-1" : rest.length <= 4 ? "columns-1 sm:columns-2" : "columns-1 sm:columns-2 lg:columns-3";

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

  const Meta = ({ task }: { task: Task }) => {
    const delayed = isDelayed(task, threshold);
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-px text-[11px] font-bold ${STATUS_BADGE[task.status]}`}>
          {STATUS_LABEL[task.status]}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-px text-[11px] font-bold text-slate-500">
          {PRIORITY_LABEL[task.priority]}优先级
        </span>
        {delayed && (
          <span className="rounded bg-red-50 px-1.5 py-px text-[11px] font-bold text-red-600">
            ⏭️ 已延期{task.reschedule_count > 0 ? ` ${task.reschedule_count} 次` : ""}
          </span>
        )}
        {ownerMap?.[task.owner_id] && (
          <span className="rounded bg-slate-400 px-1.5 py-px text-[11px] font-bold text-white">
            {ownerMap[task.owner_id]}
          </span>
        )}
        {task.link && (
          <a
            href={task.link}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="text-[13px] text-brand-500 hover:text-brand-700"
            title="打开链接"
          >
            🔗
          </a>
        )}
      </div>
    );
  };

  const Kicker = ({ task }: { task: Task }) => {
    const type = task.type_id != null ? typeMap.get(task.type_id) : undefined;
    return (
      <div
        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: type?.color || "#64748b" }}
      >
        <span>{typeEmoji(type?.icon)}</span>
        <span>{type?.name || "未分类"}</span>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-[#fbfaf6] shadow-cardlg animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 报头 */}
        <div className="shrink-0 border-b-4 border-double border-slate-800 px-7 pt-5 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-serif text-2xl font-black tracking-[0.35em] text-slate-900 sm:text-3xl">今日要闻</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                <span className="font-serif text-sm font-bold text-slate-700">
                  {dj.format("M月D日")} 星期{WEEK_LABELS[dj.isoWeekday() - 1]}
                </span>
                {mark?.type === "holiday" && <span className="font-bold text-red-600">· {mark.label}</span>}
                {mark?.type === "makeup" && <span className="font-bold text-brand-700">· 调休上班</span>}
                <span className="text-slate-300">|</span>
                <span>
                  共 {total} 项 · 完成 {rate}%
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full px-2 py-0.5 text-xl leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              title="关闭（Esc）"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 版面 */}
        <div className="flex-1 overflow-auto px-7 py-5">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="font-serif text-lg font-bold text-slate-400">今日暂无记事</div>
              <button
                onClick={onAdd}
                className="mt-4 rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-card hover:bg-brand-700"
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

              {/* 头条：跨全宽 */}
              {headline && (
                <article
                  {...dragProps(headline)}
                  className={`mb-5 cursor-move border-b border-slate-300 pb-5 transition ${
                    dragId === headline.id ? "opacity-40" : ""
                  } ${overId === headline.id ? "rounded-lg ring-2 ring-brand-300" : ""}`}
                >
                  <Kicker task={headline} />
                  <h2
                    className={`mt-1 font-serif text-2xl font-black leading-snug sm:text-3xl ${
                      headline.status === "done" ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {headline.title}
                  </h2>
                  <Meta task={headline} />
                  {headline.conclusion && (
                    <p className="mt-2 font-serif text-[15px] leading-relaxed text-slate-600 line-clamp-4">
                      {headline.status === "done" ? "✅ " : ""}
                      {headline.conclusion}
                    </p>
                  )}
                </article>
              )}

              {/* 其余：自适应多栏 */}
              {rest.length > 0 && (
                <div className={`${colClass} gap-7`} style={{ columnRule: "1px solid #d6d3c8" }}>
                  {rest.map((task) => (
                    <article
                      key={task.id}
                      {...dragProps(task)}
                      className={`mb-5 break-inside-avoid cursor-move border-t border-slate-200 pt-3 transition ${
                        dragId === task.id ? "opacity-40" : ""
                      } ${overId === task.id ? "rounded-lg ring-2 ring-brand-300" : ""}`}
                    >
                      <Kicker task={task} />
                      <h3
                        className={`mt-1 font-serif text-lg font-bold leading-snug ${
                          task.status === "done" ? "text-slate-400 line-through" : "text-slate-800"
                        }`}
                      >
                        {task.title}
                      </h3>
                      <Meta task={task} />
                      {task.conclusion && (
                        <p className="mt-1.5 font-serif text-sm leading-relaxed text-slate-500 line-clamp-3">
                          {task.status === "done" ? "✅ " : ""}
                          {task.conclusion}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 报脚 */}
        <div className="shrink-0 border-t border-slate-300 px-7 py-2 text-center text-[11px] tracking-widest text-slate-400">
          CalendarRecord · 今日要闻
        </div>
      </div>
    </div>
  );
}
