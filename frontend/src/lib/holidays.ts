import { getDayDetail } from "chinese-days";

export type DayMark =
  | { type: "holiday"; label: string } // 法定节假日（红）
  | { type: "makeup" } // 调休上班日（蓝）
  | null;

/**
 * 判断某天的节假日/调休标记。
 * - 周末且 work=true → 调休·班（蓝）
 * - work=false 且带节假日名（"English,中文,idx"）→ 法定节假日（红）
 */
export function getDayMark(dateStr: string): DayMark {
  let det: { date: string; work: boolean; name: string };
  try {
    det = getDayDetail(dateStr) as typeof det;
  } catch {
    return null;
  }
  const wd = new Date(dateStr + "T00:00:00").getDay(); // 0=Sun..6=Sat
  const isWeekend = wd === 0 || wd === 6;
  const parts = det.name.split(",");
  const hasHolidayName = parts.length >= 2;

  if (isWeekend && det.work) return { type: "makeup" };
  if (!det.work && hasHolidayName) return { type: "holiday", label: parts[1] };
  return null;
}
