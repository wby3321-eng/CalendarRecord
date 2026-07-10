import type { Task, TaskType } from "../types";
import { typeEmoji, UNTYPED_ID } from "../lib/logic";

interface Props {
  types: TaskType[];
  tasks: Task[];
  selectedTypes: Set<number>;
  setSelectedTypes: (s: Set<number>) => void;
  onManage: () => void;
  onOpenTagCloud: () => void;
}

const BASE =
  "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[13px] font-semibold select-none transition hover:shadow-card";

export default function TypeChips({ types, tasks, selectedTypes, setSelectedTypes, onManage, onOpenTagCloud }: Props) {
  const filtering = selectedTypes.size > 0;
  const countOf = (id: number) =>
    id === UNTYPED_ID
      ? tasks.filter((t) => t.type_id == null).length
      : tasks.filter((t) => t.type_id === id).length;
  const untypedCount = countOf(UNTYPED_ID);

  const toggle = (id: number) => {
    const next = new Set(selectedTypes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTypes(next);
  };

  // 未筛选：全部图例常态高亮；筛选中：选中的品牌高亮、其余弱化
  const chipCls = (id: number) => {
    if (selectedTypes.has(id)) return `${BASE} bg-brand-50 border-brand-500 text-brand-700`;
    if (filtering) return `${BASE} opacity-45 bg-slate-100 border-slate-200 text-slate-500`;
    return `${BASE} bg-white border-slate-200 text-slate-700`;
  };

  const chip = (id: number, color: string, icon: string, name: string) => (
    <button
      key={id}
      onClick={() => toggle(id)}
      title={selectedTypes.has(id) ? "取消该类型筛选" : "只看该类型（可多选叠加）"}
      className={chipCls(id)}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="leading-none">{icon}</span>
      <span>{name}</span>
      <span className="text-[11px] font-semibold text-slate-400">{countOf(id)}</span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pt-2 pb-3.5">
      <button
        onClick={() => filtering && setSelectedTypes(new Set())}
        title="显示全部类型"
        className={`${BASE} ${
          filtering ? "bg-white border-slate-200 text-slate-600" : "bg-brand-500 border-brand-500 text-white"
        }`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="w-3.5 h-3.5">
          <rect x="1" y="1" width="6" height="6" rx="1.6" />
          <rect x="9" y="1" width="6" height="6" rx="1.6" />
          <rect x="1" y="9" width="6" height="6" rx="1.6" />
          <rect x="9" y="9" width="6" height="6" rx="1.6" />
        </svg>
        全部
        <span className={`text-[11px] font-semibold ${filtering ? "text-slate-400" : "text-white/85"}`}>
          {tasks.length}
        </span>
      </button>

      {types.map((t) => chip(t.id, t.color, typeEmoji(t.icon), t.name))}
      {untypedCount > 0 && chip(UNTYPED_ID, "#94a3b8", "🏷️", "未分类")}

      <button
        onClick={onOpenTagCloud}
        title="标签云"
        className="ml-1.5 inline-flex items-center justify-center rounded-full border-[1.5px] border-dashed border-slate-300 px-2.5 py-1 text-[15px] leading-none hover:bg-brand-50 transition"
      >
        🏷️
      </button>
      <button
        onClick={onManage}
        title="类型管理"
        className="inline-flex items-center justify-center rounded-full border-[1.5px] border-dashed border-slate-300 px-2.5 py-1 text-[15px] leading-none text-brand-700 hover:bg-brand-50 transition"
      >
        ⚙️
      </button>
    </div>
  );
}
