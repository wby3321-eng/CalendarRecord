import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import type { ViewMode } from "../types";

dayjs.extend(isoWeek);

export { dayjs };

export const FMT = "YYYY-MM-DD";

export function today(): string {
  return dayjs().format(FMT);
}

/** 与后端 build_date_range 对齐：周一为首。 */
export function buildDateRange(
  view: ViewMode,
  anchor: string,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } {
  const a = dayjs(anchor);
  if (view === "week") {
    const start = a.isoWeekday(1);
    return { start: start.format(FMT), end: start.add(6, "day").format(FMT) };
  }
  if (view === "month") {
    const first = a.date(1);
    const last = first.endOf("month");
    const gridStart = first.isoWeekday(1);
    const gridEnd = last.isoWeekday(7);
    return { start: gridStart.format(FMT), end: gridEnd.format(FMT) };
  }
  // custom
  return { start: customStart || anchor, end: customEnd || anchor };
}

/** 枚举 [start, end] 内的所有日期。 */
export function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  while (cur.isBefore(last) || cur.isSame(last, "day")) {
    days.push(cur.format(FMT));
    cur = cur.add(1, "day");
  }
  return days;
}

/** 将日期数组按 7 天分行（用于月历）。 */
export function chunkWeeks(days: string[]): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

export function diffDays(from: string, to: string): number {
  return dayjs(to).diff(dayjs(from), "day");
}

export function addDays(d: string, n: number): string {
  return dayjs(d).add(n, "day").format(FMT);
}

export const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function isToday(d: string): boolean {
  return dayjs(d).isSame(dayjs(), "day");
}

export function isWeekend(d: string): boolean {
  const wd = dayjs(d).isoWeekday();
  return wd === 6 || wd === 7;
}

export function monthTitle(d: Dayjs): string {
  return d.format("YYYY 年 M 月");
}
