import { dayjs, FMT, monthTitle, today } from "../lib/date";
import type { ViewMode } from "../types";

interface Props {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  anchor: string;
  setAnchor: (d: string) => void;
  customStart: string;
  setCustomStart: (d: string) => void;
  customEnd: string;
  setCustomEnd: (d: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

const VIEW_LABEL: Record<ViewMode, string> = {
  week: "周",
  month: "月",
  custom: "自定义",
};

export default function Toolbar(p: Props) {
  const step = (dir: number) => {
    const unit = p.view === "month" ? "month" : "week";
    p.setAnchor(dayjs(p.anchor).add(dir, unit).format(FMT));
  };

  const title =
    p.view === "month"
      ? monthTitle(dayjs(p.anchor))
      : p.view === "week"
      ? `${dayjs(p.anchor).isoWeekday(1).format("M月D日")} - ${dayjs(p.anchor)
          .isoWeekday(7)
          .format("M月D日")}`
      : "自定义区间";

  return (
    <div className="flex flex-wrap items-center gap-3.5 px-4 sm:px-6 pt-3.5 pb-1.5">
      {/* 视图切换分段 */}
      <div className="inline-flex bg-slate-100 rounded-[9px] p-[3px]">
        {(["week", "month", "custom"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => p.setView(v)}
            className={`px-4 py-1.5 rounded-[7px] text-[13px] font-semibold transition ${
              p.view === v ? "bg-white text-brand-700 shadow-card" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {/* 日期导航 */}
      {p.view !== "custom" ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => step(-1)}
            className="border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-slate-700 hover:bg-brand-50 hover:border-brand-100 transition"
            title="上一段"
          >
            ‹
          </button>
          <button
            onClick={() => p.setAnchor(today())}
            className="border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-slate-700 hover:bg-brand-50 hover:border-brand-100 transition"
          >
            今天
          </button>
          <button
            onClick={() => step(1)}
            className="border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-slate-700 hover:bg-brand-50 hover:border-brand-100 transition"
            title="下一段"
          >
            ›
          </button>
          <span className="ml-1.5 font-bold text-[15px] text-slate-700">{title}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <input
            type="date"
            value={p.customStart}
            onChange={(e) => p.setCustomStart(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <span>至</span>
          <input
            type="date"
            value={p.customEnd}
            onChange={(e) => p.setCustomEnd(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      )}

      {/* 搜索 */}
      <div className="ml-auto relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-60">🔍</span>
        <input
          value={p.query}
          onChange={(e) => p.setQuery(e.target.value)}
          placeholder="搜索任务/结论，支持 status:in-progress 过滤"
          className="w-[240px] sm:w-[280px] pl-8 pr-8 py-2 border border-slate-200 rounded-[9px] text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        {p.query && (
          <button
            onClick={() => p.setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
