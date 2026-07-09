import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CardDisplayMode, EmptyDayStyle, GanttMode, Task, TaskType, ViewMode } from "../types";
import { useTaskMutations } from "../hooks/queries";
import {
  addDays,
  chunkWeeks,
  dayjs,
  diffDays,
  enumerateDays,
  FMT,
  isToday,
  WEEK_LABELS,
} from "../lib/date";
import { getDayMark } from "../lib/holidays";
import { isDelayed, STATUS_LABEL } from "../lib/logic";
import { cardVisual, TaskCardBody } from "./TaskCard";

interface Props {
  view: ViewMode;
  anchor: string;
  range: { start: string; end: string };
  tasks: Task[];
  types: TaskType[];
  threshold: number;
  isLoading: boolean;
  onOpenTask: (t: Task) => void;
  onAddTask: (date: string) => void;
  onOpenPaper: (date: string) => void;
  ownerMap?: Record<number, string>;
  mode: CardDisplayMode;
  ganttMode: GanttMode;
  ganttLanes: number;
  emptyDayStyle: EmptyDayStyle;
}

const SPAN_LANE_H = 20;
const MAX_CARDS = 3;
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface PopState {
  x: number;
  y: number;
  title: string;
  tasks: Task[];
}

type DragMode = "body" | "left" | "right";
interface DragState {
  taskId: number;
  mode: DragMode;
  delta: number;
  moved: boolean;
}

export default function CalendarView(p: Props) {
  const { drag } = useTaskMutations();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const typeMap = new Map(p.types.map((t) => [t.id, t]));

  // 统一对齐到「周一为首」的完整周网格
  const gridStart = dayjs(p.range.start).isoWeekday(1).format(FMT);
  const gridEnd = dayjs(p.range.end).isoWeekday(7).format(FMT);
  const days = enumerateDays(gridStart, gridEnd);
  const weeks = chunkWeeks(days);

  // 非当前范围的格子淡化
  const muted = new Set<string>();
  if (p.view === "month") {
    const m = dayjs(p.anchor).month();
    days.forEach((d) => dayjs(d).month() !== m && muted.add(d));
  } else if (p.view === "custom") {
    days.forEach((d) => (d < p.range.start || d > p.range.end) && muted.add(d));
  }

  return (
    <div className={dragState ? "dragging" : ""}>
      {p.isLoading && <div className="text-slate-400 mb-2">加载中…</div>}

      {/* 周一为首的星期表头 */}
      <div className="grid grid-cols-7 mb-2 px-1">
        {WEEK_LABELS.map((w, i) => (
          <div
            key={w}
            className={`text-center py-1.5 text-[11px] font-semibold tracking-widest ${
              i >= 5 ? "text-red-400" : "text-slate-400"
            }`}
          >
            周{w}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {weeks.map((week, i) => (
          <WeekRow
            key={i}
            days={week}
            tasks={p.tasks}
            typeMap={typeMap}
            threshold={p.threshold}
            muted={muted}
            dragState={dragState}
            setDragState={setDragState}
            onCommitDrag={(id, mode, start, due) => drag.mutate({ id, mode, start, due })}
            onOpenTask={p.onOpenTask}
            onAddTask={p.onAddTask}
            onOpenPaper={p.onOpenPaper}
            ownerMap={p.ownerMap}
            mode={p.mode}
            ganttMode={p.ganttMode}
            ganttLanes={p.ganttLanes}
            emptyDayStyle={p.emptyDayStyle}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  days: string[];
  tasks: Task[];
  typeMap: Map<number, TaskType>;
  threshold: number;
  muted: Set<string>;
  dragState: DragState | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
  onCommitDrag: (id: number, mode: DragMode, start?: string, due?: string) => void;
  onOpenTask: (t: Task) => void;
  onAddTask: (date: string) => void;
  onOpenPaper: (date: string) => void;
  ownerMap?: Record<number, string>;
  mode: CardDisplayMode;
  ganttMode: GanttMode;
  ganttLanes: number;
  emptyDayStyle: EmptyDayStyle;
}

function WeekRow(r: RowProps) {
  const cellsRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const [pop, setPop] = useState<PopState | null>(null);
  const rowStart = r.days[0];
  const rowEnd = r.days[r.days.length - 1];
  const cols = r.days.length;

  const openPop = (e: React.MouseEvent, title: string, tasks: Task[]) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPop({ x: rect.left, y: rect.bottom + 4, title, tasks });
  };

  const startDrag = (e: React.PointerEvent, task: Task, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    draggedRef.current = false;
    const cellW = (cellsRef.current?.clientWidth || 700) / cols;
    r.setDragState({ taskId: task.id, mode, delta: 0, moved: false });
    const onMove = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - e.clientX) / cellW);
      if (Math.abs(ev.clientX - e.clientX) > 4) draggedRef.current = true;
      r.setDragState((prev) => (prev ? { ...prev, delta, moved: draggedRef.current } : prev));
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const delta = Math.round((ev.clientX - e.clientX) / cellW);
      if (delta !== 0) {
        if (mode === "body") {
          r.onCommitDrag(task.id, "body", addDays(task.plan_start_date, delta), addDays(task.plan_due_date, delta));
        } else if (mode === "left") {
          const ns = addDays(task.plan_start_date, delta);
          if (ns <= task.plan_due_date) r.onCommitDrag(task.id, "left", ns, undefined);
        } else {
          const nd = addDays(task.plan_due_date, delta);
          if (nd >= task.plan_start_date) r.onCommitDrag(task.id, "right", undefined, nd);
        }
      }
      r.setDragState(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // 跨天任务：未完成的与本周相交，生成横跨甘特跨度条（已完成的降级为卡片）
  const spanTasks = r.tasks
    .filter(
      (t) =>
        t.plan_due_date > t.plan_start_date &&
        t.status !== "done" &&
        t.plan_start_date <= rowEnd &&
        t.plan_due_date >= rowStart
    )
    .sort((a, b) => a.plan_start_date.localeCompare(b.plan_start_date));

  const laneEnds: string[] = [];
  const spans = spanTasks.map((t) => {
    let lane = laneEnds.findIndex((end) => end < t.plan_start_date);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(t.plan_due_date);
    } else {
      laneEnds[lane] = t.plan_due_date;
    }
    return { task: t, lane };
  });
  // 泳道上限：card 模式为 0（全部跨天任务转卡片），lane 模式取设置的条数
  const laneCap = r.ganttMode === "card" ? 0 : r.ganttLanes;
  const visibleSpans = spans.filter((s) => s.lane < laneCap);
  // 超出泳道上限的跨天任务：降级为格子卡片（带甘特标志），不再折叠成气泡
  const overflowSpanIds = new Set(spans.filter((s) => s.lane >= laneCap).map((s) => s.task.id));
  const spanLanes = Math.min(laneEnds.length, laneCap);
  const stripH = spanLanes > 0 ? spanLanes * SPAN_LANE_H + 4 : 0;

  // 卡片：单天任务 + 已完成的跨天任务 + 溢出泳道的跨天任务，按开始日落到对应格子。
  // 未完成且仍在可见泳道内的跨天任务由顶部甘特条表达。
  const cardsByDay = new Map<string, Task[]>();
  for (const t of r.tasks) {
    const isSpan = t.plan_due_date > t.plan_start_date;
    if (isSpan && t.status !== "done" && !overflowSpanIds.has(t.id)) continue;
    let day: string | null = null;
    if (isSpan) {
      // 跨天卡片（已完成或溢出）：与本周相交则落到开始日（早于本周则落到本周首日）
      if (t.plan_start_date <= rowEnd && t.plan_due_date >= rowStart) {
        day = t.plan_start_date < rowStart ? rowStart : t.plan_start_date;
      }
    } else if (t.plan_start_date >= rowStart && t.plan_start_date <= rowEnd) {
      day = t.plan_start_date;
    }
    if (day) {
      const list = cardsByDay.get(day) || [];
      list.push(t);
      cardsByDay.set(day, list);
    }
  }
  for (const list of cardsByDay.values()) {
    list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  }

  return (
    <div>
      {/* 甘特跨度条（跨天任务） */}
      {stripH > 0 && (
        <div className="relative mb-1" style={{ height: stripH }}>
          {visibleSpans.map(({ task, lane }) => {
            const ds = r.dragState?.taskId === task.id ? r.dragState : null;
            let sCol = Math.max(0, diffDays(rowStart, task.plan_start_date));
            let eCol = Math.min(cols - 1, diffDays(rowStart, task.plan_due_date));
            if (ds) {
              if (ds.mode === "body") {
                sCol += ds.delta;
                eCol += ds.delta;
              } else if (ds.mode === "left") sCol += ds.delta;
              else eCol += ds.delta;
            }
            sCol = Math.max(0, Math.min(cols - 1, sCol));
            eCol = Math.max(sCol, Math.min(cols - 1, eCol));
            const type = task.type_id != null ? r.typeMap.get(task.type_id) : undefined;
            const color = type?.color || "#94a3b8";
            const startsBefore = task.plan_start_date < rowStart;
            const endsAfter = task.plan_due_date > rowEnd;
            const delayed = isDelayed(task, r.threshold);
            return (
              <div
                key={task.id}
                onClick={() => {
                  if (!draggedRef.current) r.onOpenTask(task);
                }}
                className="absolute flex items-center gap-1 px-1.5 text-[11px] cursor-grab overflow-hidden"
                style={{
                  left: `${(sCol / cols) * 100}%`,
                  width: `${((eCol - sCol + 1) / cols) * 100}%`,
                  top: lane * SPAN_LANE_H + 2,
                  height: SPAN_LANE_H - 4,
                  backgroundColor: "#3b82f622",
                  borderTop: "2px solid #3b82f6",
                  borderRadius: `${startsBefore ? 0 : 4}px ${endsAfter ? 0 : 4}px ${endsAfter ? 0 : 4}px ${
                    startsBefore ? 0 : 4
                  }px`,
                }}
                title={`${task.title}（${task.plan_start_date} → ${task.plan_due_date}）`}
              >
                {/* 左缘手柄 */}
                {!startsBefore && (
                  <span
                    onPointerDown={(e) => startDrag(e, task, "left")}
                    className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize"
                    style={{ backgroundColor: color, touchAction: "none" }}
                    title="拖动改开始日"
                  />
                )}
                <span
                  onPointerDown={(e) => startDrag(e, task, "body")}
                  className="flex-1 truncate px-1 text-slate-600"
                  style={{ touchAction: "none" }}
                >
                  {task.title}
                </span>
                {delayed && (
                  <span
                    className="shrink-0 leading-none font-bold text-red-600"
                    title={`已延期${task.reschedule_count > 0 ? ` ${task.reschedule_count} 次` : ""}`}
                  >
                    ⏭️{task.reschedule_count > 0 ? ` ${task.reschedule_count}` : ""}
                  </span>
                )}
                {task.link && (
                  <a
                    href={task.link}
                    target="_blank"
                    rel="noreferrer"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    title="打开链接"
                    className={`shrink-0 leading-none text-brand-500 hover:text-brand-700 ${endsAfter ? "" : "mr-1.5"}`}
                  >
                    🔗
                  </a>
                )}
                {/* 右缘手柄 */}
                {!endsAfter && (
                  <span
                    onPointerDown={(e) => startDrag(e, task, "right")}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize"
                    style={{ backgroundColor: color, touchAction: "none" }}
                    title="拖动改计划完成日（甘特）"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 日期格子 */}
      <div
        ref={cellsRef}
        className={`grid grid-cols-7 gap-2 ${r.emptyDayStyle === "shrink" ? "items-start" : ""}`}
      >
        {r.days.map((d) => {
          const mark = getDayMark(d);
          const dnum = Number(d.slice(8, 10));
          const isMuted = r.muted.has(d);
          const today = isToday(d);
          const cards = cardsByDay.get(d) || [];
          const isEmpty = !today && cards.length === 0;
          const compact = r.emptyDayStyle === "shrink" && isEmpty;
          const bgBorder = today
            ? "border-brand-600 ring-2 ring-brand-100 bg-brand-50"
            : isMuted
            ? "border-slate-200 opacity-50 bg-slate-50"
            : isEmpty
            ? "border-slate-100 bg-slate-50"
            : "border-slate-200 bg-white";
          const dateCls = today
            ? "text-[17px] font-extrabold text-brand-700"
            : isEmpty
            ? "text-[15px] font-bold text-slate-300"
            : "text-[15px] font-bold text-slate-700";
          return (
            <div
              key={d}
              onClick={() => r.onOpenPaper(d)}
              title="查看当日报纸"
              className={`group/cell flex flex-col rounded-card border overflow-hidden cursor-pointer transition hover:border-brand-300 hover:shadow-sm ${
                compact ? "min-h-[46px] hover:bg-brand-50" : "min-h-[132px] sm:min-h-[148px]"
              } ${bgBorder}`}
            >
              <div
                className={`flex items-center justify-between px-2 py-1.5 ${compact ? "" : "border-b border-slate-100"}`}
              >
                <div className="flex items-baseline gap-1">
                  <span className={dateCls}>{dnum}</span>
                  {today && (
                    <span className="text-[10px] font-bold text-white bg-brand-600 rounded px-1 leading-tight">
                      今
                    </span>
                  )}
                </div>
                {mark?.type === "holiday" && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-px truncate max-w-[70px]">
                    {mark.label}
                  </span>
                )}
                {mark?.type === "makeup" && (
                  <span className="text-[10px] font-bold text-brand-700 bg-brand-50 rounded px-1.5 py-px">调休·班</span>
                )}
              </div>

              {!compact && (
                <>
                  <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1.5">
                {cards.slice(0, MAX_CARDS).map((task) => {
                  const type = task.type_id != null ? r.typeMap.get(task.type_id) : undefined;
                  const dragging = r.dragState?.taskId === task.id && r.dragState.moved;
                  const delayed = isDelayed(task, r.threshold);
                  const visual = cardVisual(type?.color || "#94a3b8", task.status, r.mode, delayed);
                  const isSpan = task.plan_due_date > task.plan_start_date;
                  return (
                    <div key={task.id} className="relative">
                      <div
                        onPointerDown={(e) => startDrag(e, task, "body")}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggedRef.current) r.onOpenTask(task);
                          draggedRef.current = false;
                        }}
                        className={`group cursor-grab ${visual.className} ${
                          dragging ? "opacity-50" : ""
                        }`}
                        style={{ ...visual.style, touchAction: "none" }}
                      >
                        {isSpan && (
                          <div
                            className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500"
                            title={`跨天任务 ${task.plan_start_date} → ${task.plan_due_date}`}
                          >
                            <span
                              className="inline-block h-1.5 w-4 shrink-0 rounded-full"
                              style={{ backgroundColor: type?.color || "#94a3b8" }}
                            />
                            {task.plan_start_date.slice(5)}→{task.plan_due_date.slice(5)}
                          </div>
                        )}
                        <TaskCardBody task={task} type={type} threshold={r.threshold} ownerLabel={r.ownerMap?.[task.owner_id]} />
                      </div>
                      {/* 左右缘手柄：改开始/完成日（跨天甘特） */}
                      <span
                        onPointerDown={(e) => startDrag(e, task, "left")}
                        className="absolute left-0 top-1 bottom-1 w-1.5 cursor-ew-resize rounded-l opacity-0 group-hover:opacity-60"
                        style={{ backgroundColor: type?.color || "#94a3b8", touchAction: "none" }}
                        title="拖动改开始日"
                      />
                      <span
                        onPointerDown={(e) => startDrag(e, task, "right")}
                        className="absolute right-0 top-1 bottom-1 w-1.5 cursor-ew-resize rounded-r opacity-0 group-hover:opacity-60"
                        style={{ backgroundColor: type?.color || "#94a3b8", touchAction: "none" }}
                        title="拖动改计划完成日（甘特）"
                      />
                    </div>
                  );
                })}
                {cards.length > MAX_CARDS && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPop(e, `${dnum} 日 · ${cards.length} 项`, cards);
                    }}
                    className="rounded-md py-0.5 text-[11px] text-slate-500 hover:bg-slate-100"
                  >
                    +{cards.length - MAX_CARDS} 更多
                  </button>
                )}
              </div>

              <div className="mx-1.5 mb-1.5 mt-0.5 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    r.onAddTask(d);
                  }}
                  title="新增任务"
                  className="rounded-md p-1 text-slate-300 transition hover:bg-brand-50 hover:text-brand-600"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {pop && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPop(null)} />
          <div
            className="fixed z-50 w-56 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-cardlg animate-pop"
            style={{ left: Math.min(pop.x, window.innerWidth - 236), top: pop.y }}
          >
            <div className="px-1 pb-1 text-xs text-slate-400">{pop.title}</div>
            {pop.tasks.map((task) => {
              const type = task.type_id != null ? r.typeMap.get(task.type_id) : undefined;
              return (
                <button
                  key={task.id}
                  onClick={() => {
                    setPop(null);
                    r.onOpenTask(task);
                  }}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-slate-50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: type?.color || "#94a3b8" }} />
                  <span className="flex-1 truncate text-xs text-slate-700">{task.title}</span>
                  <span className="text-[10px] text-slate-400">{STATUS_LABEL[task.status]}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
