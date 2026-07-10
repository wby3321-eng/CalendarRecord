import { useMemo, useState } from "react";
import { useAuth } from "./store/auth";
import { useTasks, useTypes, useUsers } from "./hooks/queries";
import { buildDateRange, dayjs, FMT, today } from "./lib/date";
import { getTaskTags, parseSearch, UNTYPED_ID } from "./lib/logic";
import type { CardDisplayMode, EmptyDayStyle, GanttMode, Task, ViewMode } from "./types";
import Login from "./components/Login";
import TopBar from "./components/TopBar";
import UserRail from "./components/UserRail";
import Toolbar from "./components/Toolbar";
import TypeChips from "./components/TypeChips";
import CalendarView from "./components/CalendarView";
import TaskCard from "./components/TaskCard";
import TaskDrawer from "./components/TaskDrawer";
import TypeManager from "./components/TypeManager";
import AIPanel from "./components/AIPanel";
import PaperView from "./components/PaperView";
import TagCloud from "./components/TagCloud";

const THRESHOLD_KEY = "cr_delay_threshold";
const DISPLAY_MODE_KEY = "cr_card_display_mode";
const GANTT_MODE_KEY = "cr_gantt_mode";
const GANTT_LANES_KEY = "cr_gantt_lanes";
const EMPTY_DAY_STYLE_KEY = "cr_empty_day_style";

export default function App() {
  const { user, loading } = useAuth();

  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<string>(today());
  const [customStart, setCustomStart] = useState<string>(today());
  const [customEnd, setCustomEnd] = useState<string>(dayjs().add(14, "day").format(FMT));
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<number>>(new Set());
  const [viewOwner, setViewOwner] = useState<string>("");
  const [threshold, setThreshold] = useState<number>(
    Number(localStorage.getItem(THRESHOLD_KEY)) || 3
  );
  const [displayMode, setDisplayMode] = useState<CardDisplayMode>(
    (localStorage.getItem(DISPLAY_MODE_KEY) as CardDisplayMode) || "default"
  );
  const [ganttMode, setGanttMode] = useState<GanttMode>(
    (localStorage.getItem(GANTT_MODE_KEY) as GanttMode) || "lane"
  );
  const [ganttLanes, setGanttLanes] = useState<number>(
    Number(localStorage.getItem(GANTT_LANES_KEY)) || 3
  );
  const [emptyDayStyle, setEmptyDayStyle] = useState<EmptyDayStyle>(
    (localStorage.getItem(EMPTY_DAY_STYLE_KEY) as EmptyDayStyle) || "dim"
  );

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(null);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showTagCloud, setShowTagCloud] = useState(false);
  const [paperDate, setPaperDate] = useState<string | null>(null);

  const searching = query.trim().length > 0;
  const isAdmin = user?.role === "admin";

  const range = useMemo(
    () => buildDateRange(view, anchor, customStart, customEnd),
    [view, anchor, customStart, customEnd]
  );

  const ownerParam = isAdmin && viewOwner ? { owner_id: viewOwner } : {};
  const taskParams = searching
    ? { q: query, ...ownerParam }
    : { view, anchor, custom_start: customStart, custom_end: customEnd, ...ownerParam };

  const { data: types = [] } = useTypes(!!user);
  const { data: users = [] } = useUsers(!!user && isAdmin);
  const { data: tasks = [], isLoading } = useTasks(taskParams, !!user);

  const ownerMap = useMemo(() => {
    const m: Record<number, string> = {};
    users.forEach((u) => {
      m[u.id] = u.nickname || u.username;
    });
    return m;
  }, [users]);
  // 管理员聚合查看时，卡片标注归属用户
  const cardOwnerMap = isAdmin && !viewOwner ? ownerMap : undefined;

  const updateThreshold = (v: number) => {
    setThreshold(v);
    localStorage.setItem(THRESHOLD_KEY, String(v));
  };

  const updateDisplayMode = (m: CardDisplayMode) => {
    setDisplayMode(m);
    localStorage.setItem(DISPLAY_MODE_KEY, m);
  };

  const updateGanttMode = (m: GanttMode) => {
    setGanttMode(m);
    localStorage.setItem(GANTT_MODE_KEY, m);
  };

  const updateGanttLanes = (n: number) => {
    const v = Math.min(6, Math.max(1, n));
    setGanttLanes(v);
    localStorage.setItem(GANTT_LANES_KEY, String(v));
  };

  const updateEmptyDayStyle = (s: EmptyDayStyle) => {
    setEmptyDayStyle(s);
    localStorage.setItem(EMPTY_DAY_STYLE_KEY, s);
  };

  const visibleTasks = useMemo(
    () =>
      selectedTypes.size === 0
        ? tasks
        : tasks.filter((t) => selectedTypes.has(t.type_id ?? UNTYPED_ID)),
    [tasks, selectedTypes]
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => getTaskTags(t).forEach((tag) => s.add(tag)));
    return [...s].sort((a, b) => a.localeCompare(b, "zh"));
  }, [tasks]);

  // 当日报纸：与该日相交的任务（含跨天），按优先级降序排列作为默认版序
  const paperTasks = useMemo(() => {
    if (!paperDate) return [];
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return visibleTasks
      .filter((t) => t.plan_start_date <= paperDate && t.plan_due_date >= paperDate)
      .sort((a, b) => rank[a.priority] - rank[b.priority] || a.id - b.id);
  }, [visibleTasks, paperDate]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center text-slate-400">
        加载中…
      </div>
    );
  }
  if (!user) return <Login />;

  return (
    <div className="flex h-full">
      {isAdmin && users.length > 1 && (
        <UserRail
          users={users}
          viewOwner={viewOwner}
          setViewOwner={setViewOwner}
          currentUserId={user.id}
        />
      )}

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <TopBar
          threshold={threshold}
          setThreshold={updateThreshold}
          displayMode={displayMode}
          setDisplayMode={updateDisplayMode}
          ganttMode={ganttMode}
          setGanttMode={updateGanttMode}
          ganttLanes={ganttLanes}
          setGanttLanes={updateGanttLanes}
          emptyDayStyle={emptyDayStyle}
          setEmptyDayStyle={updateEmptyDayStyle}
        />

        <Toolbar
          view={view}
          setView={setView}
          anchor={anchor}
          setAnchor={setAnchor}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          query={query}
          setQuery={setQuery}
        />

        <TypeChips
          types={types}
          tasks={tasks}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          onManage={() => setShowTypeManager(true)}
          onOpenTagCloud={() => setShowTagCloud(true)}
        />

        <main className="flex-1 overflow-auto p-3 sm:p-4">
          {searching ? (
            <SearchResults
              tasks={visibleTasks}
              types={types}
              threshold={threshold}
              query={query}
              isLoading={isLoading}
              onOpen={setEditingTask}
              ownerMap={cardOwnerMap}
              mode={displayMode}
            />
          ) : (
            <CalendarView
              view={view}
              anchor={anchor}
              range={range}
              tasks={visibleTasks}
              types={types}
              threshold={threshold}
              isLoading={isLoading}
              onOpenTask={setEditingTask}
              onAddTask={(d) => setCreatingDate(d)}
              onOpenPaper={setPaperDate}
              ownerMap={cardOwnerMap}
              mode={displayMode}
              ganttMode={ganttMode}
              ganttLanes={ganttLanes}
              emptyDayStyle={emptyDayStyle}
            />
          )}
        </main>
      </div>

      {paperDate && (
        <PaperView
          date={paperDate}
          tasks={paperTasks}
          types={types}
          threshold={threshold}
          ownerMap={cardOwnerMap}
          onOpenTask={setEditingTask}
          onAdd={() => setCreatingDate(paperDate)}
          onClose={() => setPaperDate(null)}
        />
      )}

      {(editingTask || creatingDate) && (
        <TaskDrawer
          task={editingTask}
          defaultDate={creatingDate}
          types={types}
          allTags={allTags}
          onClose={() => {
            setEditingTask(null);
            setCreatingDate(null);
          }}
        />
      )}

      {showTypeManager && (
        <TypeManager types={types} onClose={() => setShowTypeManager(false)} />
      )}

      {showTagCloud && (
        <TagCloud
          ownerId={isAdmin && viewOwner ? viewOwner : undefined}
          onPick={(tag) => {
            setQuery(`tag:${tag}`);
            setShowTagCloud(false);
          }}
          onClose={() => setShowTagCloud(false)}
        />
      )}

      {showAI && (
        <AIPanel params={taskParams} onClose={() => setShowAI(false)} />
      )}

      {/* AI 悬浮球（报纸浮层打开时隐藏，避免遮挡） */}
      {!paperDate && (
        <button
          onClick={() => setShowAI(true)}
          className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-cardlg bg-gradient-to-br from-brand-600 to-brand-400 hover:-translate-y-0.5 transition"
        >
          🤖 AI 分析
        </button>
      )}
    </div>
  );
}

function SearchResults({
  tasks,
  types,
  threshold,
  query,
  isLoading,
  onOpen,
  ownerMap,
  mode,
}: {
  tasks: Task[];
  types: import("./types").TaskType[];
  threshold: number;
  query: string;
  isLoading: boolean;
  onOpen: (t: Task) => void;
  ownerMap?: Record<number, string>;
  mode: CardDisplayMode;
}) {
  const parsed = parseSearch(query);
  return (
    <div>
      <div className="text-sm text-slate-500 mb-3">
        搜索结果 {tasks.length} 条
        {parsed.statuses.length > 0 && ` · 状态:${parsed.statuses.join("/")}`}
        {parsed.types.length > 0 && ` · 类型:${parsed.types.join("/")}`}
        {parsed.tags.length > 0 && ` · 标签:${parsed.tags.join("/")}`}
        {parsed.text && ` · 关键词:"${parsed.text}"`}
      </div>
      {isLoading ? (
        <div className="text-slate-400">加载中…</div>
      ) : tasks.length === 0 ? (
        <div className="text-slate-400">无匹配任务</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white rounded-lg p-2 shadow-sm">
              <div className="text-xs text-slate-400 mb-1">
                {t.plan_start_date}
                {t.plan_due_date !== t.plan_start_date && ` → ${t.plan_due_date}`}
              </div>
              <TaskCard
                task={t}
                type={types.find((x) => x.id === t.type_id)}
                threshold={threshold}
                onOpen={() => onOpen(t)}
                ownerLabel={ownerMap?.[t.owner_id]}
                mode={mode}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
