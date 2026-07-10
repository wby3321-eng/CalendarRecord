import { useState, type ReactNode } from "react";
import type { User } from "../types";

interface Props {
  users: User[];
  viewOwner: string;
  setViewOwner: (v: string) => void;
  currentUserId?: number;
}

const RAIL_COLLAPSED_KEY = "cr_rail_collapsed";

// 稳定头像配色：按 id 取模，用户之间可区分且刷新不变
const PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];
const colorFor = (id: number) => PALETTE[id % PALETTE.length];

function RailAvatar({
  active,
  onClick,
  label,
  avatarClass = "",
  avatarStyle,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  avatarClass?: string;
  avatarStyle?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="group relative flex w-full justify-center">
      {/* 当前项高亮指示条 */}
      <span
        className={`absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 transition-all ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-30"
        }`}
      />
      <button
        onClick={onClick}
        title={label}
        className={`flex h-10 w-10 items-center justify-center overflow-hidden text-sm font-bold shadow-card transition-all ${
          active
            ? "rounded-xl ring-2 ring-brand-500 ring-offset-2 ring-offset-slate-50"
            : "rounded-2xl hover:rounded-xl"
        } ${avatarClass}`}
        style={avatarStyle}
      >
        {children}
      </button>
      {/* hover 名称气泡 */}
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-cardlg transition group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

export default function UserRail({ users, viewOwner, setViewOwner, currentUserId }: Props) {
  const allActive = viewOwner === "";
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = () =>
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(RAIL_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore quota */
      }
      return next;
    });

  // 收起态：仅保留左边缘细把手，闭眼图标点击展开
  if (collapsed) {
    return (
      <button
        onClick={toggle}
        title="展开用户栏"
        className="group flex h-full w-6 shrink-0 flex-col items-center justify-center border-r border-slate-200 bg-slate-50 transition hover:bg-slate-100"
      >
        <EyeOffIcon className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500" />
      </button>
    );
  }

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center gap-1.5 border-r border-slate-200 bg-slate-50 py-3">
      <button
        onClick={toggle}
        title="折叠用户栏"
        className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-200 hover:text-slate-600"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      <RailAvatar
        active={allActive}
        onClick={() => setViewOwner("")}
        label="全部用户（聚合）"
        avatarClass={
          allActive ? "bg-brand-600 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200"
        }
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </RailAvatar>

      <div className="my-0.5 h-px w-8 shrink-0 bg-slate-200" />

      <div className="flex w-full flex-col items-center gap-1.5">
        {users.map((u) => {
          const name = u.nickname || u.username;
          const isSelf = u.id === currentUserId;
          return (
            <RailAvatar
              key={u.id}
              active={viewOwner === String(u.id)}
              onClick={() => setViewOwner(String(u.id))}
              label={`${name} · @${u.username}${isSelf ? "（我）" : ""}`}
              avatarClass="text-white"
              avatarStyle={{ backgroundColor: colorFor(u.id) }}
            >
              {name.slice(0, 1).toUpperCase()}
            </RailAvatar>
          );
        })}
      </div>
    </aside>
  );
}
