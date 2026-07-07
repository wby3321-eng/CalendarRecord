import { useState, type CSSProperties } from "react";
import type { CardDisplayMode, Priority, Task, TaskType } from "../types";
import { useTaskMutations } from "../hooks/queries";
import { cycleStatus, isDelayed, PRIORITY_LABEL, truncateConclusion, typeEmoji } from "../lib/logic";

const PRIORITY_PILL: Record<Priority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-sky-100 text-sky-700",
};

/** 类型图标：统一映射为 emoji（内置图标名/自定义 emoji 皆可）。 */
function typeIcon(type?: TaskType): string | null {
  if (!type) return null;
  return typeEmoji(type.icon);
}

// 「类型色」模式：底色用类型色，随状态由深到浅（待办≈35% / 进行中≈18% / 完成≈8%）
const TYPECOLOR_ALPHA: Record<Task["status"], string> = {
  todo: "59",
  "in-progress": "2e",
  done: "14",
};

/** 卡片容器样式：按展示模式返回 className + inline style。 */
export function cardVisual(
  color: string,
  status: Task["status"],
  mode: CardDisplayMode,
  delayed: boolean
): { className: string; style: CSSProperties } {
  const base = "rounded-md border px-2 py-1.5 text-xs transition hover:shadow-cardmd hover:-translate-y-px";
  if (mode === "typeColor") {
    return {
      className: `${base} ${delayed ? "border-red-300 ring-1 ring-red-200" : "border-transparent"}`,
      style: { backgroundColor: `${color}${TYPECOLOR_ALPHA[status]}`, borderLeft: `3px solid ${color}` },
    };
  }
  const done = status === "done";
  return {
    className: `${base} bg-white ${delayed ? "border-red-200 ring-1 ring-red-200" : "border-slate-100"} ${
      done ? "bg-slate-50" : ""
    }`,
    style: { borderLeft: `3px solid ${color}` },
  };
}

function StatusDot({ status, onToggle }: { status: Task["status"]; onToggle: (backward: boolean) => void }) {
  const cls =
    status === "done"
      ? "bg-green-500 border-green-500 text-white"
      : status === "in-progress"
      ? "bg-amber-500 border-amber-500 text-white"
      : "border-slate-300 text-transparent";
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
      title="点击切换状态：待办 → 进行中 → 已完成（Shift 逆序）"
      className={`shrink-0 w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center text-[9px] leading-none ${cls}`}
    >
      {status === "done" ? "✔" : ""}
    </button>
  );
}

/** 卡片内容（无外层容器/交互），供日历格子卡片与搜索结果复用。 */
export function TaskCardBody({
  task,
  type,
  threshold,
  ownerLabel,
}: {
  task: Task;
  type?: TaskType;
  threshold: number;
  ownerLabel?: string;
}) {
  const { setStatus } = useTaskMutations();
  const [hover, setHover] = useState(false);
  const delayed = isDelayed(task, threshold);
  const done = task.status === "done";
  const preview = truncateConclusion(task.conclusion, 20);
  const truncated = task.conclusion.length > 20;
  const icon = typeIcon(type);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <StatusDot
          status={task.status}
          onToggle={(backward) =>
            setStatus.mutate({ id: task.id, status: cycleStatus(task.status, backward ? "backward" : "forward") })
          }
        />
        {icon && <span className="shrink-0 text-[13px] leading-none">{icon}</span>}
        <span
          className={`flex-1 min-w-0 truncate font-medium ${
            done ? "line-through text-slate-400" : "text-slate-700"
          }`}
        >
          {task.title}
        </span>
        {ownerLabel && (
          <span className="shrink-0 text-[10px] font-semibold text-white bg-slate-400 rounded px-1">{ownerLabel}</span>
        )}
        {task.link && (
          <a
            href={task.link}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            title="打开链接"
            className="shrink-0 text-brand-500 hover:text-brand-700"
          >
            🔗
          </a>
        )}
        <span className={`shrink-0 text-[10px] font-bold px-1.5 rounded ${PRIORITY_PILL[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      {delayed && (
        <div className="mt-1 inline-block text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-px">
          ⏭️ +{task.reschedule_count > 0 ? ` ${task.reschedule_count}` : ""}
        </div>
      )}

      {preview && (
        <div
          className="relative mt-1 text-slate-400"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <span className="truncate block">
            {done ? "✅ " : ""}
            {preview}
            {truncated ? "…" : ""}
          </span>
          {truncated && hover && (
            <div className="absolute z-20 left-0 top-5 w-56 max-h-40 overflow-auto bg-slate-800 text-white text-xs rounded-md p-2 shadow-cardlg whitespace-pre-wrap">
              {task.conclusion}
            </div>
          )}
        </div>
      )}
    </>
  );
}

interface Props {
  task: Task;
  type?: TaskType;
  threshold: number;
  onOpen: () => void;
  ownerLabel?: string;
  mode?: CardDisplayMode;
}

export default function TaskCard({ task, type, threshold, onOpen, ownerLabel, mode = "default" }: Props) {
  const delayed = isDelayed(task, threshold);
  const visual = cardVisual(type?.color || "#94a3b8", task.status, mode, delayed);
  return (
    <div onClick={onOpen} className={`group cursor-pointer ${visual.className}`} style={visual.style}>
      <TaskCardBody task={task} type={type} threshold={threshold} ownerLabel={ownerLabel} />
    </div>
  );
}
