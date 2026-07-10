import { useEffect, useMemo, useRef, useState } from "react";
import type { Attachment, Priority, Status, Task, TaskType } from "../types";
import { useTaskMutations } from "../hooks/queries";
import { api } from "../api/client";
import { getTaskTags, normalizeTags, PRIORITY_LABEL, STATUS_LABEL, STATUSES, tagColor } from "../lib/logic";
import { today } from "../lib/date";

interface Props {
  task: Task | null;
  defaultDate: string | null;
  types: TaskType[];
  allTags?: string[];
  onClose: () => void;
}

export default function TaskDrawer({ task, defaultDate, types, allTags, onClose }: Props) {
  const { create, update, remove, resetReschedule } = useTaskMutations();
  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title || "");
  const [typeId, setTypeId] = useState<number | null>(task?.type_id ?? types[0]?.id ?? null);
  const [link, setLink] = useState(task?.link || "");
  const [conclusion, setConclusion] = useState(task?.conclusion || "");
  const [status, setStatus] = useState<Status>(task?.status || "todo");
  const [priority, setPriority] = useState<Priority>(task?.priority || "medium");
  const [startDate, setStartDate] = useState(task?.plan_start_date || defaultDate || today());
  const [dueDate, setDueDate] = useState(task?.plan_due_date || defaultDate || today());
  const [ext, setExt] = useState<Record<string, unknown>>(task?.ext_fields || {});
  const [tags, setTags] = useState<string[]>(task ? getTaskTags(task) : []);
  const [tagInput, setTagInput] = useState("");
  const [tagEditing, setTagEditing] = useState(false);
  const tagBoxRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>(task?.attachments || []);
  const [rescheduleCount, setRescheduleCount] = useState(task?.reschedule_count ?? 0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedType = types.find((t) => t.id === typeId);

  const addTags = (raw: string[]) => {
    setTags((prev) => normalizeTags([...prev, ...raw]));
    setTagInput("");
  };
  const commitTagInput = () => {
    const parts = tagInput.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) addTags(parts);
    else setTagInput("");
  };
  const onTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" || e.key === "," || e.key === "，") {
      e.preventDefault();
      commitTagInput();
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setTagInput("");
      setTagEditing(false);
    }
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const suggestions = useMemo(() => {
    const lower = tagInput.trim().toLowerCase();
    const chosen = new Set(tags.map((t) => t.toLowerCase()));
    return (allTags || [])
      .filter((t) => !chosen.has(t.toLowerCase()) && (!lower || t.toLowerCase().includes(lower)))
      .slice(0, 8);
  }, [allTags, tags, tagInput]);

  // 编辑标签时点击别处：提交待录入文本并收起（表单仍在「保存」时统一提交）
  useEffect(() => {
    if (!tagEditing) return;
    const h = (e: MouseEvent) => {
      if (tagBoxRef.current && !tagBoxRef.current.contains(e.target as Node)) {
        commitTagInput();
        setTagEditing(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagEditing, tagInput]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const save = async () => {
    setErr("");
    if (!title.trim()) return setErr("任务名称必填");
    if (dueDate < startDate) return setErr("计划完成日不能早于开始日");
    setBusy(true);
    const cleanTags = normalizeTags([...tags, ...tagInput.split(/[,，]/).map((s) => s.trim())]);
    const payload: Partial<Task> = {
      title,
      type_id: typeId,
      link,
      conclusion,
      status,
      priority,
      plan_start_date: startDate,
      plan_due_date: dueDate,
      ext_fields: { ...ext, tags: cleanTags },
    };
    try {
      if (isEdit) await update.mutateAsync({ id: task!.id, data: payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!task || !confirm("确定删除该任务？")) return;
    await remove.mutateAsync(task.id);
    onClose();
  };

  const resetDelay = async () => {
    if (!task) return;
    await resetReschedule.mutateAsync(task.id);
    setRescheduleCount(0);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setBusy(true);
    try {
      const att = await api.uploadFile(task.id, file);
      setAttachments((a) => [...a, att]);
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const delAtt = async (id: number) => {
    await api.deleteAttachment(id);
    setAttachments((a) => a.filter((x) => x.id !== id));
  };

  const fieldInput = (key: string, type: string) => {
    const val = (ext[key] as string) ?? "";
    const set = (v: string) => setExt((p) => ({ ...p, [key]: v }));
    if (type === "textarea")
      return (
        <textarea value={val} onChange={(e) => set(e.target.value)} rows={2} className={inputCls} />
      );
    return <input value={val} onChange={(e) => set(e.target.value)} className={inputCls} placeholder={type === "link" ? "https://" : ""} />;
  };

  const typeColor = selectedType?.color || "#3b82f6";
  const summary = `计划 ${startDate.slice(5)} → ${dueDate.slice(5)} · ${PRIORITY_LABEL[priority]}优先级`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-cardlg overflow-hidden animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部类型色渐变条 */}
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundImage: `linear-gradient(90deg, ${typeColor}, ${typeColor}22)` }}
        />

        {/* 头部 */}
        <div className="flex items-start justify-between gap-3 px-6 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h3 className="shrink-0 text-lg font-bold text-slate-800">{isEdit ? "编辑任务" : "新增任务"}</h3>
              {tagEditing ? (
                <div ref={tagBoxRef} className="min-w-0 flex-1 basis-[200px]">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-brand-300 px-2 py-1.5 ring-2 ring-brand-100 transition">
                    {tags.map((t) => {
                      const c = tagColor(t);
                      return (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold"
                          style={{ backgroundColor: c.bg, color: c.fg }}
                        >
                          #{t}
                          <button
                            type="button"
                            onClick={() => removeTag(t)}
                            className="leading-none opacity-60 hover:opacity-100"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                    <input
                      autoFocus
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={onTagKey}
                      placeholder={tags.length ? "" : "回车 / 逗号添加"}
                      className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none"
                    />
                  </div>
                  {suggestions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addTags([s])}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-200"
                        >
                          ＋ {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => setTagEditing(true)}
                  title="点击编辑标签"
                  className="flex flex-wrap items-center gap-1.5 cursor-pointer"
                >
                  {tags.map((t) => {
                    const c = tagColor(t);
                    return (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold"
                        style={{ backgroundColor: c.bg, color: c.fg }}
                      >
                        #{t}
                      </span>
                    );
                  })}
                  <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-[12px] text-slate-400 transition hover:border-brand-300 hover:text-brand-500">
                    ＋ 标签
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">{summary}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-600 text-lg leading-none -mr-1 -mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* 主体 */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
          <Section title="基本信息">
            <Field label="任务名称 *">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="类型">
                <select value={typeId ?? ""} onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                  <option value="">未分类</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="优先级">
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={inputCls}>
                  {(["high", "medium", "low"] as Priority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="状态">
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm border transition ${
                      status === s
                        ? "bg-brand-50 border-brand-500 text-brand-700 font-medium"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="计划安排">
            <div className="grid grid-cols-2 gap-3">
              <Field label="计划开始日">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="计划完成日">
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="链接">
              <input value={link} onChange={(e) => setLink(e.target.value)} className={inputCls} placeholder="https://" />
            </Field>

            {isEdit && (
              <Field label="延期次数">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    已延期 <span className="font-semibold text-slate-700">{rescheduleCount}</span> 次
                  </span>
                  <button
                    type="button"
                    onClick={resetDelay}
                    disabled={rescheduleCount === 0 || resetReschedule.isPending}
                    title="重置延期次数"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-3.5 w-3.5 ${resetReschedule.isPending ? "animate-spin" : ""}`}
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </div>
              </Field>
            )}
          </Section>

          <Section title="结论与附件">
            <Field label="结论">
              <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={3} className={inputCls} />
            </Field>

            {selectedType && selectedType.field_defs.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">扩展字段（{selectedType.name}）</div>
                {selectedType.field_defs.map((fd) => (
                  <Field key={fd.key} label={fd.label}>
                    {fieldInput(fd.key, fd.type)}
                  </Field>
                ))}
              </div>
            )}

            <div>
              <div className="text-xs text-slate-500 mb-1.5">附件</div>
              {!isEdit ? (
                <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">保存任务后可添加附件</div>
              ) : (
                <>
                  <div className="space-y-1 mb-2">
                    {attachments.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <span>{a.kind === "image" ? "🖼️" : "📎"}</span>
                        <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-brand-600 hover:underline">
                          {a.filename}
                        </a>
                        <button onClick={() => delAtt(a.id)} className="text-slate-400 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                  <label
                    title="上传文件/图片"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-brand-600 cursor-pointer hover:bg-brand-50 transition"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 6.16l-8.58 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    上传
                    <input type="file" className="hidden" onChange={onUpload} />
                  </label>
                </>
              )}
            </div>
          </Section>

          {err && <div className="text-sm text-red-500">{err}</div>}
        </div>

        {/* 底部操作栏 */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 shrink-0 bg-white">
          {isEdit && (
            <button onClick={del} title="删除任务" className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">
            取消
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="px-6 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-lg shadow-card hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition";

const STATUS_DOT: Record<Status, string> = {
  todo: "bg-slate-400",
  "in-progress": "bg-amber-500",
  done: "bg-emerald-500",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
