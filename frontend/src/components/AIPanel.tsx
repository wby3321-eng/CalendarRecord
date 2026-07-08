import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIPreset } from "../types";
import { api } from "../api/client";

interface Props {
  params: Record<string, string | undefined>;
  onClose: () => void;
}

const VIEW_LABEL: Record<string, string> = { week: "本周", month: "本月", custom: "自定义区间" };

const MD_COMPONENTS: Components = {
  h1: ({ node, ...p }) => <h1 className="text-base font-bold text-slate-800 mt-4 mb-2 first:mt-0" {...p} />,
  h2: ({ node, ...p }) => <h2 className="text-[15px] font-bold text-slate-800 mt-4 mb-2 first:mt-0" {...p} />,
  h3: ({ node, ...p }) => <h3 className="text-sm font-semibold text-slate-700 mt-3 mb-1.5 first:mt-0" {...p} />,
  p: ({ node, ...p }) => <p className="my-2 leading-relaxed" {...p} />,
  ul: ({ node, ...p }) => <ul className="my-2 pl-5 list-disc space-y-1" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-2 pl-5 list-decimal space-y-1" {...p} />,
  li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-slate-800" {...p} />,
  a: ({ node, ...p }) => <a className="text-brand-600 hover:underline" target="_blank" rel="noreferrer" {...p} />,
  code: ({ node, ...p }) => <code className="px-1 py-0.5 rounded bg-slate-100 text-[12px] text-brand-700" {...p} />,
  blockquote: ({ node, ...p }) => (
    <blockquote className="border-l-2 border-brand-300 pl-3 my-2 text-slate-500" {...p} />
  ),
  table: ({ node, ...p }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-[13px] border-collapse" {...p} />
    </div>
  ),
  thead: ({ node, ...p }) => <thead className="bg-slate-100" {...p} />,
  th: ({ node, ...p }) => (
    <th className="border border-slate-200 px-2.5 py-1.5 text-left font-semibold text-slate-600" {...p} />
  ),
  td: ({ node, ...p }) => <td className="border border-slate-200 px-2.5 py-1.5" {...p} />,
  hr: () => <hr className="my-3 border-slate-100" />,
};

export default function AIPanel({ params, onClose }: Props) {
  const [presets, setPresets] = useState<AIPreset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.aiPresets().then(setPresets).catch(() => setPresets([]));
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    outRef.current?.scrollTo(0, outRef.current.scrollHeight);
  }, [output]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const scope = useMemo(() => {
    const parts: string[] = [];
    if (params.q) {
      parts.push(`🔍 搜索「${params.q}」`);
    } else {
      const v = params.view ? VIEW_LABEL[params.view] ?? params.view : "";
      if (v) parts.push(`📆 ${v}`);
      if (params.view === "custom" && params.custom_start && params.custom_end)
        parts.push(`${params.custom_start} → ${params.custom_end}`);
    }
    if (params.owner_id) parts.push("👤 指定用户");
    return parts.length ? parts.join(" · ") : "全部数据";
  }, [params]);

  const run = async (preset?: string, customPrompt?: string) => {
    setRunning(true);
    setOutput("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset, prompt: customPrompt, ...params }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`请求失败 (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() || "";
        for (const chunk of lines) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const obj = JSON.parse(data);
            if (obj.delta) setOutput((o) => o + obj.delta);
          } catch {
            /* ignore partial */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setOutput((o) => o + `\n\n[错误] ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-cardlg overflow-hidden animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部 AI 主题渐变条 */}
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundImage: "linear-gradient(90deg, #7c3aed, #3b82f6)" }}
        />

        {/* 头部 */}
        <div className="flex items-start justify-between px-6 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg text-white shadow-card"
              style={{ backgroundImage: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}
            >
              🤖
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">AI 数据分析</h3>
              <p className="text-xs text-slate-400 mt-0.5">基于当前筛选数据生成分析报告</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none -mr-1 -mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* 主体 */}
        <div ref={outRef} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {/* 范围条 */}
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="font-semibold text-slate-600">分析范围</span>
            <span className="text-slate-400">·</span>
            <span className="truncate">{scope}</span>
          </div>

          {/* 预设卡 */}
          <div className="grid grid-cols-2 gap-2.5">
            {presets.map((p) => (
              <button
                key={p.key}
                disabled={running}
                onClick={() => run(p.key)}
                className="text-left rounded-xl border border-slate-200 px-3.5 py-2.5 transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="block text-[13px] font-semibold text-slate-700">{p.label}</span>
                <span className="block text-[11px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                  {p.prompt}
                </span>
              </button>
            ))}
          </div>

          {/* 自定义提示词 */}
          <div className="flex gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="自定义提示词，例如：分析我在阅读类任务上的投入…"
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
              onKeyDown={(e) => e.key === "Enter" && prompt.trim() && !running && run(undefined, prompt)}
            />
            <button
              disabled={running || !prompt.trim()}
              onClick={() => run(undefined, prompt)}
              className="px-5 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl shadow-card hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              生成
            </button>
          </div>

          {/* 报告卡 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 min-h-[160px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">分析报告</span>
              {running && (
                <button
                  onClick={stop}
                  className="text-xs text-slate-500 border border-slate-200 rounded-lg px-2 py-0.5 hover:bg-white"
                >
                  停止
                </button>
              )}
            </div>
            {output ? (
              <div className="text-[13.5px] text-slate-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                  {output}
                </ReactMarkdown>
                {running && (
                  <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            ) : running ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 mt-6 justify-center">
                <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse" />
                正在生成…
              </div>
            ) : (
              <div className="text-sm text-slate-300 text-center mt-8">
                点击上方预设或输入提示词，即可基于当前筛选数据生成分析报告
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            分析由智谱 GLM 基于当前筛选数据生成，结果仅供参考。
          </p>
        </div>
      </div>
    </div>
  );
}
