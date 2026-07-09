import { useState } from "react";
import { useAuth } from "../store/auth";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(username, password);
      else await register(username, password, nickname);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-brand-600">CalendarRecord</div>
          <div className="text-sm text-slate-400 mt-1">成长日历 · 记录与复盘</div>
        </div>

        <div className="flex mb-6 bg-slate-100 rounded-lg p-1 text-sm">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErr("");
              }}
              className={`flex-1 py-1.5 rounded-md transition ${
                mode === m ? "bg-white shadow text-brand-600 font-medium" : "text-slate-500"
              }`}
            >
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {mode === "register" && (
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="昵称（可选）"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          )}
          <input
            type="password"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && <div className="text-sm text-red-500">{err}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
          >
            {busy ? "处理中…" : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        {mode === "login" && (
          <div className="text-xs text-slate-400 mt-4 text-center">
            {/* 默认管理员：admin / admin123 */}
          </div>
        )}
      </div>
    </div>
  );
}
