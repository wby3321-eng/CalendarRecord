import { useEffect, useState } from "react";
import type { Attachment, Priority, Status, Task, TaskType } from "../types";
import { useTaskMutations } from "../hooks/queries";
import { api } from "../api/client";
import { PRIORITY_LABEL, STATUS_LABEL, STATUSES } from "../lib/logic";
import { today } from "../lib/date";

interface Props {
  task: Task | null;
  defaultDate: string | null;
  types: TaskType[];
  onClose: () => void;
}

export default function TaskDrawer({ task, defaultDate, types, onClose }: Props) {
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
  const [attachments, setAttachments] = useState<Attachment[]>(task?.attachments || []);
  const [rescheduleCount, setRescheduleCount] = useState(task?.reschedule_count ?? 0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedType = types.find((t) => t.id === typeId);

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
    const payload: Partial<Task> = {
      title,
      type_id: typeId,
      link,
      conclusion,
      status,
      priority,
      plan_start_date: startDate,
      plan_due_date: dueDate,
      ext_fields: ext,
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
        <div className="flex items-start justify-between px-6 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{isEdit ? "编辑任务" : "新增任务"}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{summary}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none -mr-1 -mt-0.5"
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
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resetReschedule.isPending ? "重置中…" : "重置"}
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
                  <label className="inline-block text-sm text-brand-600 cursor-pointer hover:underline">
                    + 上传文件/图片
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
            <button onClick={del} className="px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg">
              删除
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
