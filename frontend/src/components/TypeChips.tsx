import type { Task, TaskType } from "../types";
import { typeEmoji } from "../lib/logic";

interface Props {
  types: TaskType[];
  tasks: Task[];
  hiddenTypes: Set<number>;
  setHiddenTypes: (s: Set<number>) => void;
  onManage: () => void;
}

export default function TypeChips({ types, tasks, hiddenTypes, setHiddenTypes, onManage }: Props) {
  const countOf = (id: number) => tasks.filter((t) => t.type_id === id).length;

  const toggle = (id: number) => {
    const next = new Set(hiddenTypes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHiddenTypes(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pt-2 pb-3.5">
      {/* <span className="text-xs text-slate-400 mr-0.5">类型图例 · 点击切换显隐：</span> */}
      {types.map((t) => {
        const off = hiddenTypes.has(t.id);
        return (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            title={off ? "点击显示" : "点击隐藏"}
            className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[13px] font-semibold select-none transition hover:shadow-card ${
              off
                ? "opacity-45 bg-slate-100 border-slate-200 text-slate-500 line-through"
                : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="leading-none">{typeEmoji(t.icon)}</span>
            <span>{t.name}</span>
            <span className="text-[11px] text-slate-400 font-semibold">{countOf(t.id)}</span>
          </button>
        );
      })}
      <button
        onClick={onManage}
        className="ml-1.5 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-slate-300 px-3 py-1 text-[13px] font-semibold text-brand-700 hover:bg-brand-50 transition"
      >
        ⚙️ 类型管理
      </button>
    </div>
  );
}
