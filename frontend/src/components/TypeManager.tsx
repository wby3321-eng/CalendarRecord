import { useState } from "react";
import type { FieldDef, TaskType } from "../types";
import { useTypeMutations } from "../hooks/queries";
import { useAuth } from "../store/auth";
import { typeEmoji } from "../lib/logic";

interface Props {
  types: TaskType[];
  onClose: () => void;
}

const PRESET_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899", "#ef4444", "#14b8a6", "#64748b"];
const PRESET_ICONS = ["🏷️", "🎯", "✅", "💡", "📖", "⭐", "🚀", "🔥", "📌", "💼", "🧩", "🏆"];
const FIELD_TYPES: { value: FieldDef["type"]; label: string }[] = [
  { value: "text", label: "文本" },
  { value: "link", label: "链接" },
  { value: "textarea", label: "多行文本" },
  { value: "image", label: "图片" },
  { value: "file", label: "文件" },
];

export default function TypeManager({ types, onClose }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const builtin = types.filter((t) => t.is_builtin);
  const custom = types.filter((t) => !t.is_builtin);
  const [editing, setEditing] = useState<TaskType | "new" | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-white rounded-xl shadow-cardlg animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-700">类型管理</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs text-slate-400 mb-2">
              内置类型{isAdmin ? "（管理员可编辑 · 对所有用户生效）" : "（不可修改）"}
            </div>
            {isAdmin ? (
              <div className="space-y-2">
                {builtin.map((t) =>
                  editing !== null && editing !== "new" && editing.id === t.id ? (
                    <TypeEditor key={t.id} type={t} allowDelete={false} onDone={() => setEditing(null)} />
                  ) : (
                    <div key={t.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span>{typeEmoji(t.icon)}</span>
                      <span className="flex-1 text-sm text-slate-700">{t.name}</span>
                      <span className="text-xs text-slate-400">{t.field_defs.length} 个字段</span>
                      <button onClick={() => setEditing(t)} className="text-sm text-slate-500 hover:text-brand-600">编辑</button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {builtin.map((t) => (
                  <span key={t.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm" style={{ backgroundColor: `${t.color}18`, color: t.color }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span>{typeEmoji(t.icon)}</span>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-400">自定义类型</div>
              {editing !== "new" && (
                <button onClick={() => setEditing("new")} className="text-sm text-brand-600 hover:underline">
                  + 新建类型
                </button>
              )}
            </div>

            {editing === "new" && <TypeEditor onDone={() => setEditing(null)} />}

            <div className="space-y-2 mt-2">
              {custom.map((t) =>
                editing !== null && editing !== "new" && editing.id === t.id ? (
                  <TypeEditor key={t.id} type={t} onDone={() => setEditing(null)} />
                ) : (
                  <div key={t.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span>{typeEmoji(t.icon)}</span>
                    <span className="flex-1 text-sm text-slate-700">{t.name}</span>
                    <span className="text-xs text-slate-400">{t.field_defs.length} 个字段</span>
                    <button onClick={() => setEditing(t)} className="text-sm text-slate-500 hover:text-brand-600">编辑</button>
                  </div>
                )
              )}
              {custom.length === 0 && editing !== "new" && (
                <div className="text-sm text-slate-400">暂无自定义类型</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeEditor({ type, onDone, allowDelete = true }: { type?: TaskType; onDone: () => void; allowDelete?: boolean }) {
  const { create, update, remove } = useTypeMutations();
  const [name, setName] = useState(type?.name || "");
  const [color, setColor] = useState(type?.color || PRESET_COLORS[0]);
  const [icon, setIcon] = useState(type?.icon || PRESET_ICONS[0]);
  const [fields, setFields] = useState<FieldDef[]>(type?.field_defs || []);
  const [err, setErr] = useState("");

  const addField = () => setFields((f) => [...f, { key: `f${Date.now()}`, label: "", type: "text" }]);
  const updateField = (i: number, patch: Partial<FieldDef>) =>
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeField = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) return setErr("类型名称必填");
    const cleanFields = fields.filter((f) => f.label.trim());
    const data = { name, color, icon: icon.trim() || "🏷️", field_defs: cleanFields };
    try {
      if (type) await update.mutateAsync({ id: type.id, data });
      else await create.mutateAsync(data);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const del = async () => {
    if (!type || !confirm("删除该类型？其下任务将变为未分类。")) return;
    await remove.mutateAsync(type.id);
    onDone();
  };

  return (
    <div className="border border-brand-200 bg-brand-50/40 rounded-lg p-3 space-y-3">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="类型名称" className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-slate-500 mr-1">图标</span>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          maxLength={4}
          placeholder="🏷️"
          className="w-12 px-2 py-1 border border-slate-200 rounded text-center text-base outline-none focus:ring-2 focus:ring-brand-500"
        />
        {PRESET_ICONS.map((ic) => (
          <button
            key={ic}
            onClick={() => setIcon(ic)}
            className={`w-7 h-7 rounded text-base leading-none flex items-center justify-center ${
              icon === ic ? "ring-2 ring-brand-400 bg-brand-50" : "hover:bg-slate-100"
            }`}
          >
            {ic}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 mr-1">颜色</span>
        {PRESET_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-slate-400" : ""}`} style={{ backgroundColor: c }} />
        ))}
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-1">扩展字段</div>
        <div className="space-y-1.5">
          {fields.map((f, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="字段名" className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm" />
              <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FieldDef["type"] })} className="px-2 py-1 border border-slate-200 rounded text-sm">
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
              <button onClick={() => removeField(i)} className="text-slate-400 hover:text-red-500 px-1">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addField} className="text-xs text-brand-600 hover:underline mt-1">+ 添加字段</button>
      </div>

      {err && <div className="text-sm text-red-500">{err}</div>}

      <div className="flex gap-2">
        {type && allowDelete && (
          <button onClick={del} className="px-2 py-1 text-sm text-red-500 hover:bg-red-50 rounded">删除</button>
        )}
        <div className="flex-1" />
        <button onClick={onDone} className="px-3 py-1 text-sm text-slate-500 hover:bg-slate-100 rounded">取消</button>
        <button onClick={save} className="px-3 py-1 text-sm bg-brand-600 text-white rounded hover:bg-brand-700">保存</button>
      </div>
    </div>
  );
}
