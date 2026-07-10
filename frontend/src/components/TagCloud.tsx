import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTasks } from "../hooks/queries";
import { getTaskTags, tagColor } from "../lib/logic";

interface Props {
  ownerId?: string;
  onPick: (tag: string) => void;
  onClose: () => void;
}

interface Placed {
  tag: string;
  count: number;
  size: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD_X = 11; // chip 左右内边距
const PAD_Y = 5; // chip 上下内边距
const GAP = 7; // chip 之间安全间距
const V_SQUASH = 0.62; // 纵向压缩螺旋，让整体更接近圆形而非横向摊开

/** 螺旋打包：按字号由大到小，用 Archimedean 螺旋 + AABB 碰撞把标签铺成一团近圆形。 */
function computeLayout(
  items: { tag: string; count: number }[],
  sizeFor: (count: number) => number
): { placed: Placed[]; width: number; height: number } {
  if (items.length === 0) return { placed: [], width: 0, height: 0 };
  const ctx = document.createElement("canvas").getContext("2d");
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  const boxes = items.map(({ tag, count }) => {
    const size = sizeFor(count);
    let textW = size * (tag.length + 1) * 0.6; // canvas 不可用时的兜底估算
    if (ctx) {
      ctx.font = `600 ${size}px ${family}`;
      textW = ctx.measureText(`#${tag}`).width;
    }
    const badgeW = String(count).length * 7 + 16; // 计数徽章估宽
    const w = Math.ceil(textW + badgeW + PAD_X * 2);
    const h = Math.ceil(size + PAD_Y * 2);
    return { tag, count, size, w, h };
  });

  const placed: Placed[] = [];
  const hits = (x: number, y: number, w: number, h: number) =>
    placed.some(
      (o) => x < o.x + o.w + GAP && x + w + GAP > o.x && y < o.y + o.h + GAP && y + h + GAP > o.y
    );

  boxes.forEach((b) => {
    if (placed.length === 0) {
      placed.push({ ...b, x: -b.w / 2, y: -b.h / 2 });
      return;
    }
    let px = -b.w / 2;
    let py = -b.h / 2;
    for (let theta = 0; theta < 600; theta += 0.35) {
      const rad = 7 * theta;
      const x = Math.cos(theta) * rad - b.w / 2;
      const y = Math.sin(theta) * rad * V_SQUASH - b.h / 2;
      if (!hits(x, y, b.w, b.h)) {
        px = x;
        py = y;
        break;
      }
    }
    placed.push({ ...b, x: px, y: py });
  });

  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  const maxX = Math.max(...placed.map((p) => p.x + p.w));
  const maxY = Math.max(...placed.map((p) => p.y + p.h));
  placed.forEach((p) => {
    p.x -= minX;
    p.y -= minY;
  });
  return { placed, width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY) };
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

  const { placed, width, height } = useMemo(() => {
    const max = cloud.length ? cloud[0].count : 1;
    const sizeFor = (count: number) => {
      const min = 14;
      const maxSize = 34;
      if (max <= 1) return min + 6;
      return Math.round(min + (maxSize - min) * (Math.sqrt(count) / Math.sqrt(max)));
    };
    return computeLayout(cloud, sizeFor);
  }, [cloud]);

  // 按容器宽度等比缩放，保证圆形词云完整显示
  const bodyRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const avail = Math.max(0, boxW - 48);
  const scale = width && avail ? Math.min(1, avail / width) : 1;

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
            <p className="mt-0.5 text-xs text-slate-400">字号越大使用越多 · 点击标签即可筛选相关任务</p>
          </div>
          <button onClick={onClose} className="-mr-1 -mt-0.5 text-lg leading-none text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-auto px-6 py-6">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">加载中…</div>
          ) : cloud.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl">🏷️</div>
              <div className="mt-3 text-sm font-semibold text-slate-500">还没有任何标签</div>
              <div className="mt-1 text-xs text-slate-400">在任务的「基本信息」里为任务添加标签后即可在此汇总</div>
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center">
              <div style={{ position: "relative", width: width * scale, height: height * scale }}>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width,
                    height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {placed.map((p) => {
                    const c = tagColor(p.tag);
                    return (
                      <button
                        key={p.tag}
                        onClick={() => onPick(p.tag)}
                        title={`筛选「${p.tag}」· 共 ${p.count} 个任务`}
                        className="absolute flex items-center justify-center gap-1 whitespace-nowrap rounded-lg font-semibold leading-none transition hover:z-10 hover:brightness-95 hover:shadow-card"
                        style={{
                          left: p.x,
                          top: p.y,
                          width: p.w,
                          height: p.h,
                          fontSize: p.size,
                          backgroundColor: c.bg,
                          color: c.fg,
                        }}
                      >
                        #{p.tag}
                        <span className="rounded-full bg-white/60 px-1.5 text-[11px] font-bold">{p.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
