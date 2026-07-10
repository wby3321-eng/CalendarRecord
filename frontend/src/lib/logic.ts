import type { Status, Task } from "../types";
import { dayjs } from "./date";

export const DEFAULT_THRESHOLD = 3;
export const STATUSES: Status[] = ["todo", "in-progress", "done"];

/** 图例筛选中代表「未分类」(type_id 为空) 任务的哨兵 id。 */
export const UNTYPED_ID = -1;

export const STATUS_LABEL: Record<Status, string> = {
  todo: "待办",
  "in-progress": "进行中",
  done: "已完成",
};

export const PRIORITY_LABEL: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/** 内置图标名 → emoji（后端种子用 lucide 命名，前端统一渲染为 emoji）。 */
const ICON_EMOJI: Record<string, string> = {
  target: "🎯",
  "check-square": "📝",
  lightbulb: "💡",
  "book-open": "📚",
  star: "🔖",
  tag: "🏷️",
};

/** 类型图标：已是 emoji 则原样返回，已知图标名映射为 emoji，其余回退标签图标。 */
export function typeEmoji(icon?: string | null): string {
  const raw = (icon || "").trim();
  if (ICON_EMOJI[raw]) return ICON_EMOJI[raw];
  if (raw && !/^[\w-]+$/.test(raw)) return raw;
  return "🏷️";
}

/** 延期高亮双条件：未完成 且 (超期 或 改期次数≥阈值)。 */
export function isDelayed(task: Task, threshold = DEFAULT_THRESHOLD): boolean {
  if (task.status === "done") return false;
  const overdue = dayjs().startOf("day").isAfter(dayjs(task.plan_due_date));
  const tooMany = task.reschedule_count >= threshold;
  return overdue || tooMany;
}

/** 结论预览：超过 n 字截断为前 n 字。 */
export function truncateConclusion(text: string, n = 20): string {
  if (!text) return "";
  return text.length <= n ? text : text.slice(0, n);
}

/** 状态循环切换（正向/逆序）。 */
export function cycleStatus(current: Status, direction: "forward" | "backward" = "forward"): Status {
  const idx = STATUSES.indexOf(current);
  const len = STATUSES.length;
  const next = direction === "forward" ? (idx + 1) % len : (idx - 1 + len) % len;
  return STATUSES[next];
}

/** 解析类 GitHub 搜索语法：status:done type:plan tag:公司 关键词。 */
export function parseSearch(query: string): {
  statuses: string[];
  types: string[];
  tags: string[];
  text: string;
} {
  const statuses: string[] = [];
  const types: string[] = [];
  const tags: string[] = [];
  const textParts: string[] = [];
  for (const token of (query || "").split(/\s+/).filter(Boolean)) {
    if (token.startsWith("status:") && token.length > 7) statuses.push(token.slice(7));
    else if (token.startsWith("type:") && token.length > 5) types.push(token.slice(5));
    else if (token.startsWith("tag:") && token.length > 4) tags.push(token.slice(4));
    else textParts.push(token);
  }
  return { statuses, types, tags, text: textParts.join(" ").trim() };
}

/** 从任务的扩展字段读取标签数组（容错非数组/空值）。 */
export function getTaskTags(task: Task): string[] {
  const raw = (task.ext_fields || {})["tags"];
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t).trim()).filter(Boolean);
}

/** 归一化标签录入：trim、去空、去重（不区分大小写保留首次原样）、单标签≤16、上限 10。 */
export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const v = (t || "").trim().slice(0, 16);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 10) break;
  }
  return out;
}

const TAG_PALETTE = [
  { bg: "#eef2ff", fg: "#4f46e5" },
  { bg: "#ecfeff", fg: "#0e7490" },
  { bg: "#ecfdf5", fg: "#047857" },
  { bg: "#fffbeb", fg: "#b45309" },
  { bg: "#fef2f2", fg: "#b91c1c" },
  { bg: "#fdf2f8", fg: "#be185d" },
  { bg: "#f5f3ff", fg: "#6d28d9" },
  { bg: "#f0fdfa", fg: "#0f766e" },
];

/** 由标签文本派生稳定配色（同名标签处处同色）。 */
export function tagColor(tag: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}
