import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Attachment, Priority, Status, Task, TaskType } from "../types";
import { dayjs, WEEK_LABELS } from "../lib/date";
import { getDayMark } from "../lib/holidays";
import { cycleStatus, isDelayed, PRIORITY_LABEL, STATUS_LABEL, typeEmoji } from "../lib/logic";
import { useTaskMutations } from "../hooks/queries";
import { api } from "../api/client";

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

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

const orderKey = (date: string) => `cr_paper_order_${date}`;
const FULLSCREEN_KEY = "cr_paper_fullscreen";

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

  const qc = useQueryClient();
  const { update, setStatus } = useTaskMutations();

  const [order, setOrder] = useState<number[]>(() => reconcile(loadOrder(date), tasks));
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ images: Attachment[]; index: number } | null>(null);
  const [fullscreen, setFullscreen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(FULLSCREEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const lightboxRef = useRef<typeof lightbox>(null);
  lightboxRef.current = lightbox;

  const openLightbox = useCallback((images: Attachment[], index: number) => setLightbox({ images, index }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const lbStep = useCallback(
    (n: number) => setLightbox((lb) => (lb ? { ...lb, index: (lb.index + n + lb.images.length) % lb.images.length } : lb)),
    []
  );

  const toggleFullscreen = () =>
    setFullscreen((v) => {
      const next = !v;
      try {
        localStorage.setItem(FULLSCREEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore quota */
      }
      return next;
    });

  useEffect(() => setOrder((prev) => reconcile(prev, tasks)), [tasks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxRef.current) setLightbox(null);
        else onClose();
      } else if (lightboxRef.current && e.key === "ArrowLeft") {
        lbStep(-1);
      } else if (lightboxRef.current && e.key === "ArrowRight") {
        lbStep(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lbStep]);

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

  // 上传图片：逐个上传后统一刷新任务列表；删除同理。
  const uploadImages = useCallback(
    async (taskId: number, files: File[]) => {
      for (const f of files) {
        try {
          await api.uploadFile(taskId, f);
        } catch {
          /* 单个失败不阻断其余 */
        }
      }
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    [qc]
  );

  const deleteImage = useCallback(
    async (id: number) => {
      await api.deleteAttachment(id);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    [qc]
  );

  const dj = dayjs(date);
  const mark = getDayMark(date);
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const rate = total ? Math.round((doneCount / total) * 100) : 0;

  const ordered = order.map((id) => taskMap.get(id)).filter((t): t is Task => !!t);

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (dragId != null) {
      swap(dragId, targetId);
    } else {
      const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length) uploadImages(targetId, files);
    }
    setDragId(null);
    setOverId(null);
  };

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

  const RING = 30;
  const CIRC = 2 * Math.PI * RING;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm ${
          fullscreen ? "p-0" : "p-4"
        }`}
        onClick={onClose}
      >
        <div
          className={`flex w-full flex-col overflow-hidden bg-white shadow-cardlg animate-pop ${
            fullscreen ? "h-full max-h-none max-w-none rounded-none" : "max-h-[90vh] max-w-5xl rounded-2xl"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 报头：现代杂志风 —— 左侧大字日期 + 品牌 eyebrow，右侧完成度圆环 */}
          <div className="relative shrink-0 border-b border-slate-100 bg-white px-8 pt-6 pb-5">
            <div className="absolute right-5 top-5 flex items-center gap-1">
              <button
                onClick={toggleFullscreen}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title={fullscreen ? "还原窗口" : "全屏展示"}
              >
                {fullscreen ? <CollapseIcon className="h-4 w-4" /> : <ExpandIcon className="h-4 w-4" />}
              </button>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="关闭（Esc）"
              >
                <span className="text-xl leading-none">✕</span>
              </button>
            </div>
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
                    ⠿ 拖动手柄可调整版面 · 点击标题 / 结论 / 标签即可就地编辑
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
                  {ordered.map((task, i) => (
                    <PaperCard
                      key={task.id}
                      task={task}
                      feature={i === 0}
                      span={colSpan(task, i)}
                      color={colorOf(task)}
                      type={typeOf(task)}
                      types={types}
                      threshold={threshold}
                      ownerName={ownerMap?.[task.owner_id]}
                      dragging={dragId === task.id}
                      over={overId === task.id}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnter={() => setOverId(task.id)}
                      onDragLeave={() => setOverId((cur) => (cur === task.id ? null : cur))}
                      onDrop={(e) => handleDrop(e, task.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverId(null);
                      }}
                      onOpenTask={() => onOpenTask(task)}
                      onEnlarge={openLightbox}
                      onImgLoad={layoutMasonry}
                      onSaveField={(data) => update.mutate({ id: task.id, data })}
                      onSetStatus={(status) => setStatus.mutate({ id: task.id, status })}
                      onUpload={(files) => uploadImages(task.id, files)}
                      onDeleteImage={deleteImage}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onPrev={() => lbStep(-1)}
          onNext={() => lbStep(1)}
          onClose={closeLightbox}
        />
      )}
    </>
  );
}

interface PaperCardProps {
  task: Task;
  feature: boolean;
  span: number;
  color: string;
  type?: TaskType;
  types: TaskType[];
  threshold: number;
  ownerName?: string;
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onOpenTask: () => void;
  onEnlarge: (images: Attachment[], index: number) => void;
  onImgLoad: () => void;
  onSaveField: (data: Partial<Task>) => void;
  onSetStatus: (status: Status) => void;
  onUpload: (files: File[]) => void;
  onDeleteImage: (id: number) => void;
}

/** 报刊单卡：顶部配图 + 可就地编辑的标题/结论/标签，右上角为拖拽手柄、加图、详情。 */
function PaperCard({
  task,
  feature,
  span,
  color,
  type,
  types,
  threshold,
  ownerName,
  dragging,
  over,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd,
  onOpenTask,
  onEnlarge,
  onImgLoad,
  onSaveField,
  onSetStatus,
  onUpload,
  onDeleteImage,
}: PaperCardProps) {
  const articleRef = useRef<HTMLElement>(null);
  const done = task.status === "done";
  const imgs = (task.attachments || []).filter((a) => a.kind === "image");
  const delayed = isDelayed(task, threshold);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      onUpload(files);
    }
  };

  return (
    <article
      ref={articleRef}
      tabIndex={0}
      onPaste={handlePaste}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ gridColumn: `span ${span}`, borderLeftWidth: "3px", borderLeftColor: color }}
      className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card outline-none transition hover:shadow-cardmd focus-visible:ring-2 focus-visible:ring-brand-300 ${
        feature ? "p-6" : "p-4"
      } ${dragging ? "scale-[0.98] opacity-40" : ""} ${over ? "ring-2 ring-brand-400" : ""}`}
    >
      {/* 右上角操作簇：加图 · 详情 · 拖拽手柄 */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <label
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/85 text-slate-500 shadow-card backdrop-blur transition hover:bg-white hover:text-brand-600"
          title="添加图片"
          onClick={(e) => e.stopPropagation()}
        >
          <PlusIcon className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files || []);
              if (fs.length) onUpload(fs);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTask();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/85 text-slate-500 shadow-card backdrop-blur transition hover:bg-white hover:text-brand-600"
          title="详情 / 更多设置"
        >
          <DetailsIcon className="h-4 w-4" />
        </button>
        <span
          draggable
          onDragStart={(e) => {
            if (articleRef.current) e.dataTransfer.setDragImage(articleRef.current, 24, 24);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg bg-white/85 text-slate-400 shadow-card backdrop-blur transition hover:bg-white hover:text-slate-700 active:cursor-grabbing"
          title="拖动调整版面位置"
        >
          <GripIcon className="h-4 w-4" />
        </span>
      </div>

      {imgs.length > 0 && (
        <CardImages
          images={imgs}
          feature={feature}
          onEnlarge={onEnlarge}
          onImgLoad={onImgLoad}
          onDelete={onDeleteImage}
        />
      )}

      {feature && (
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300">头条 · Top Story</div>
      )}

      <InlineText
        value={task.title}
        onSave={(v) => {
          if (v) onSaveField({ title: v });
        }}
        placeholder="未命名任务"
        className={
          feature
            ? `text-2xl font-bold leading-snug sm:text-[26px] ${done ? "text-slate-400 line-through" : "text-slate-900"}`
            : `text-base font-bold leading-snug ${done ? "text-slate-400 line-through" : "text-slate-800"}`
        }
      />

      <InlineText
        value={task.conclusion}
        onSave={(v) => onSaveField({ conclusion: v })}
        placeholder="添加结论 / 记录…"
        multiline
        onResize={onImgLoad}
        prefix={done ? "✅ " : ""}
        className={
          feature
            ? "mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-600"
            : "mt-2 whitespace-pre-line text-sm leading-6 text-slate-500"
        }
      />

      {/* 标签行：类型 / 状态 / 优先级可就地切换，其余为只读标签 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <TypePicker value={task.type_id} type={type} types={types} onChange={(id) => onSaveField({ type_id: id })} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetStatus(cycleStatus(task.status, e.shiftKey ? "backward" : "forward"));
          }}
          className={`${PILL} ${STATUS_PILL[task.status]} transition hover:brightness-95`}
          title="点击切换状态（Shift 逆序）"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
          {STATUS_LABEL[task.status]}
        </button>
        <PriorityPicker value={task.priority} onChange={(p) => onSaveField({ priority: p })} />
        {delayed && (
          <span className={`${PILL} bg-red-50 text-red-600`}>
            ⏭️ 已延期{task.reschedule_count > 0 ? ` ${task.reschedule_count} 次` : ""}
          </span>
        )}
        {ownerName && <span className={`${PILL} bg-slate-400 text-white`}>@{ownerName}</span>}
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
    </article>
  );
}

/** 就地编辑文本：点击变输入框，失焦或 Enter(单行)/Cmd+Enter(多行) 保存，Esc 取消。 */
function InlineText({
  value,
  onSave,
  placeholder,
  multiline,
  className,
  prefix,
  onResize,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  prefix?: string;
  onResize?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const autoGrow = () => {
    const el = areaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (!editing) return;
    if (multiline) {
      const el = areaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        autoGrow();
      }
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, multiline]);

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const v = multiline ? draft : draft.trim();
    if (v !== value) onSave(v);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const base =
    "w-full resize-none rounded-lg border border-brand-300 bg-white px-2 py-1 shadow-sm outline-none ring-2 ring-brand-100";

  if (editing) {
    return multiline ? (
      <textarea
        ref={areaRef}
        value={draft}
        rows={2}
        onChange={(e) => {
          setDraft(e.target.value);
          autoGrow();
          onResize?.();
        }}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        className={`${className || ""} ${base}`}
      />
    ) : (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
        className={`${className || ""} ${base}`}
      />
    );
  }

  const empty = !value;
  return (
    <div
      onClick={start}
      title="点击编辑"
      className={`${className || ""} cursor-text rounded-md transition hover:bg-slate-50 ${
        empty ? "italic text-slate-300" : ""
      }`}
    >
      {empty ? placeholder : `${prefix || ""}${value}`}
    </div>
  );
}

/** 优先级就地选择：胶囊点击弹出下拉。 */
function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const opts: Priority[] = ["high", "medium", "low"];
  return (
    <span className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`${PILL} ${PRIORITY_PILL[value]} transition hover:brightness-95`}
        title="设置优先级"
      >
        {PRIORITY_LABEL[value]}优先级
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-24 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-cardlg"
          onClick={(e) => e.stopPropagation()}
        >
          {opts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (p !== value) onChange(p);
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition hover:bg-slate-50 ${
                p === value ? "font-bold text-brand-600" : "text-slate-600"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[p]}`} />
              {PRIORITY_LABEL[p]}优先级
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** 类型就地选择：胶囊点击弹出下拉（含「未分类」）。 */
function TypePicker({
  value,
  type,
  types,
  onChange,
}: {
  value: number | null;
  type?: TaskType;
  types: TaskType[];
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const tColor = type?.color || "#94a3b8";
  return (
    <span className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={PILL}
        style={{ color: tColor, backgroundColor: `${tColor}1a` }}
        title="设置类型"
      >
        <span className="text-[12px] leading-none">{typeEmoji(type?.icon)}</span>
        {type?.name || "未分类"}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 max-h-56 w-40 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-cardlg"
          onClick={(e) => e.stopPropagation()}
        >
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (t.id !== value) onChange(t.id);
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition hover:bg-slate-50 ${
                t.id === value ? "font-bold" : "text-slate-600"
              }`}
              style={t.id === value ? { color: t.color } : undefined}
            >
              <span className="text-[13px] leading-none">{typeEmoji(t.icon)}</span>
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              if (value != null) onChange(null);
            }}
            className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition hover:bg-slate-50 ${
              value == null ? "font-bold text-slate-700" : "text-slate-500"
            }`}
          >
            <span className="text-[13px] leading-none">🏷️</span>
            未分类
          </button>
        </div>
      )}
    </span>
  );
}

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const ChevronRight = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const GripIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
const DetailsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);
const PlusIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const TrashIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);
const ExpandIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);
const CollapseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M21 16h-3a2 2 0 0 0-2 2v3M3 16h3a2 2 0 0 1 2 2v3" />
  </svg>
);

/** 卡片顶部配图：主图（点击放大）+ 缩略图条切换，多图时叠加左右箭头与计数；悬停可删除。 */
function CardImages({
  images,
  feature,
  onEnlarge,
  onImgLoad,
  onDelete,
}: {
  images: Attachment[];
  feature: boolean;
  onEnlarge: (images: Attachment[], index: number) => void;
  onImgLoad: () => void;
  onDelete: (id: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const cur = Math.min(idx, images.length - 1);
  const active = images[cur];
  const multi = images.length > 1;
  const step = (n: number) => setIdx((prev) => (Math.min(prev, images.length - 1) + n + images.length) % images.length);

  return (
    <div className={feature ? "-mx-6 -mt-6 mb-4" : "-mx-4 -mt-4 mb-3"} onClick={(e) => e.stopPropagation()}>
      <div className="group/img relative overflow-hidden bg-slate-100">
        <img
          src={active.url}
          alt={active.filename}
          draggable={false}
          loading="lazy"
          onLoad={onImgLoad}
          onClick={() => onEnlarge(images, cur)}
          className={`w-full cursor-zoom-in bg-slate-100 object-cover ${feature ? "aspect-[16/9]" : "aspect-[4/3]"}`}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(active.id);
          }}
          className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/45 text-white opacity-0 transition hover:bg-red-500 group-hover/img:opacity-100"
          title="删除这张图片"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
        <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-1 text-white opacity-0 transition group-hover/img:opacity-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-3.5-3.5" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </span>
        {multi && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition hover:bg-black/60 group-hover/img:opacity-100"
              title="上一张"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition hover:bg-black/60 group-hover/img:opacity-100"
              title="下一张"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
              {cur + 1}/{images.length}
            </span>
          </>
        )}
      </div>
      {multi && (
        <div className={`mt-2 flex gap-1.5 overflow-x-auto ${feature ? "px-6" : "px-4"}`}>
          {images.map((im, k) => (
            <div
              key={im.id}
              onClick={(e) => {
                e.stopPropagation();
                setIdx(k);
              }}
              title={im.filename}
              className={`group/th relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition ${
                k === cur ? "border-brand-500" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={im.url} alt="" draggable={false} loading="lazy" className="h-full w-full object-cover" />
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(im.id);
                }}
                className="absolute right-0 top-0 hidden h-4 w-4 items-center justify-center rounded-bl bg-black/55 text-[10px] leading-none text-white hover:bg-red-500 group-hover/th:flex"
                title="删除"
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 全屏灯箱：查看原图，多图时左右切换（← →），Esc/点击空白/✕ 关闭。 */
function Lightbox({
  images,
  index,
  onPrev,
  onNext,
  onClose,
}: {
  images: Attachment[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const cur = images[index];
  const multi = images.length > 1;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-3 text-white/85">
        <span className="truncate text-sm">{cur.filename}</span>
        <div className="flex items-center gap-3">
          {multi && <span className="text-sm font-semibold tabular-nums">{index + 1} / {images.length}</span>}
          <button type="button" onClick={onClose} className="text-2xl leading-none text-white/70 transition hover:text-white" title="关闭（Esc）">
            ✕
          </button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6">
        {multi && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            title="上一张（←）"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <img
          src={cur.url}
          alt={cur.filename}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-cardlg"
        />
        {multi && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            title="下一张（→）"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
