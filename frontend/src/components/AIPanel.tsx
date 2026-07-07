import { useEffect, useRef, useState } from "react";
import type { AIPreset } from "../types";
import { api } from "../api/client";

interface Props {
  params: Record<string, string | undefined>;
  onClose: () => void;
}

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

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white shadow-cardlg flex flex-col animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">AI 分析</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-400">基于当前筛选数据分析</div>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p.key}
                disabled={running}
                onClick={() => run(p.key)}
                title={p.prompt}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50 text-slate-600 disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="自定义提示词…"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
              onKeyDown={(e) => e.key === "Enter" && prompt.trim() && !running && run(undefined, prompt)}
            />
            <button
              disabled={running || !prompt.trim()}
              onClick={() => run(undefined, prompt)}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              分析
            </button>
          </div>
        </div>

        <div ref={outRef} className="flex-1 overflow-auto px-4 pb-4">
          {output ? (
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{output}</div>
          ) : (
            <div className="text-sm text-slate-300 text-center mt-10">选择预设或输入提示词开始分析</div>
          )}
          {running && <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-0.5 align-middle" />}
        </div>
      </div>
    </div>
  );
}
