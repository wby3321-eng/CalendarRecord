import { useEffect, useMemo } from "react";
import { useTasks } from "../hooks/queries";
import { getTaskTags, tagColor } from "../lib/logic";

interface Props {
  ownerId?: string;
  onPick: (tag: string) => void;
  onClose: () => void;
}

export default function TagCloud({ ownerId, onPick, onClose }: Props) {
  // 词云需覆盖全部任务（不受当前视图/搜索限制），故用无 view 的查询
  const { data: tasks = [], isLoading } = useTasks(ownerId ? { owner_id: ownerId } : {}, true);

  const cloud = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((t) => getTaskTags(t).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh"));
  }, [tasks]);

  const max = cloud.length ? cloud[0].count : 1;
  const sizeFor = (count: number) => {
    const min = 13;
    const maxSize = 30;
    if (max <= 1) return min + 5;
    const ratio = Math.sqrt(count) / Math.sqrt(max);
    return Math.round(min + (maxSize - min) * ratio);
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-cardlg animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标签色渐变条 */}
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundImage: "linear-gradient(90deg, #6366f1, #6366f122)" }}
        />

        <div className="flex items-start justify-between border-b border-slate-100 px-6 pt-4 pb-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-lg font-bold text-slate-800">🏷️ 标签云</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              字号越大使用越多 · 点击标签即可筛选相关任务
            </p>
          </div>
          <button onClick={onClose} className="-mr-1 -mt-0.5 text-lg leading-none text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">加载中…</div>
          ) : cloud.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl">🏷️</div>
              <div className="mt-3 text-sm font-semibold text-slate-500">还没有任何标签</div>
              <div className="mt-1 text-xs text-slate-400">在任务的「基本信息」里为任务添加标签后即可在此汇总</div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              {cloud.map(({ tag, count }) => {
                const c = tagColor(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onPick(tag)}
                    title={`筛选「${tag}」· 共 ${count} 个任务`}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold leading-none transition hover:brightness-95 hover:shadow-card"
                    style={{ backgroundColor: c.bg, color: c.fg, fontSize: sizeFor(count) }}
                  >
                    #{tag}
                    <span className="rounded-full bg-white/60 px-1.5 text-[11px] font-bold">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
