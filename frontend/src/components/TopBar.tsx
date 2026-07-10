import { useAuth } from "../store/auth";
import type { CardDisplayMode, EmptyDayStyle, GanttMode } from "../types";
import Settings from "./Settings";

interface Props {
  threshold: number;
  setThreshold: (n: number) => void;
  displayMode: CardDisplayMode;
  setDisplayMode: (m: CardDisplayMode) => void;
  ganttMode: GanttMode;
  setGanttMode: (m: GanttMode) => void;
  ganttLanes: number;
  setGanttLanes: (n: number) => void;
  emptyDayStyle: EmptyDayStyle;
  setEmptyDayStyle: (s: EmptyDayStyle) => void;
}

export default function TopBar({
  threshold,
  setThreshold,
  displayMode,
  setDisplayMode,
  ganttMode,
  setGanttMode,
  ganttLanes,
  setGanttLanes,
  emptyDayStyle,
  setEmptyDayStyle,
}: Props) {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[22px] text-white shadow-card bg-gradient-to-br from-brand-600 to-brand-400">
          📅
        </div>
        <div>
          <h1 className="text-[17px] font-bold tracking-[.2px] text-slate-800 leading-tight">
            CalendarRecord
          </h1>
          <p className="text-xs text-slate-500 leading-tight">个人成长日历记录平台</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[13px] text-slate-500">
        <Settings
          threshold={threshold}
          setThreshold={setThreshold}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          ganttMode={ganttMode}
          setGanttMode={setGanttMode}
          ganttLanes={ganttLanes}
          setGanttLanes={setGanttLanes}
          emptyDayStyle={emptyDayStyle}
          setEmptyDayStyle={setEmptyDayStyle}
        />
        <button
          onClick={logout}
          title="退出登录"
          className="border border-slate-200 rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
