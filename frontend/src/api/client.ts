import type {
  AIPreset,
  Attachment,
  Task,
  TaskType,
  User,
} from "../types";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) msg = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // ---- auth ----
  register: (username: string, password: string, nickname: string) =>
    req<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, nickname }),
    }),
  login: (username: string, password: string) =>
    req<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => req<User>("/api/auth/me"),
  listUsers: () => req<User[]>("/api/auth/users"),
  updateMe: (nickname: string) =>
    req<User>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ nickname }),
    }),

  // ---- types ----
  listTypes: () => req<TaskType[]>("/api/types"),
  createType: (data: Partial<TaskType>) =>
    req<TaskType>("/api/types", { method: "POST", body: JSON.stringify(data) }),
  updateType: (id: number, data: Partial<TaskType>) =>
    req<TaskType>(`/api/types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteType: (id: number) =>
    req<{ ok: boolean }>(`/api/types/${id}`, { method: "DELETE" }),

  // ---- tasks ----
  listTasks: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, v);
    });
    return req<Task[]>(`/api/tasks?${qs.toString()}`);
  },
  createTask: (data: Partial<Task>) =>
    req<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: number, data: Partial<Task>) =>
    req<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  setStatus: (id: number, status: string) =>
    req<Task>(`/api/tasks/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  resetReschedule: (id: number) =>
    req<Task>(`/api/tasks/${id}/reset-reschedule`, { method: "POST" }),
  dragTask: (
    id: number,
    mode: "body" | "left" | "right",
    plan_start_date?: string,
    plan_due_date?: string
  ) =>
    req<Task>(`/api/tasks/${id}/drag`, {
      method: "POST",
      body: JSON.stringify({ mode, plan_start_date, plan_due_date }),
    }),
  deleteTask: (id: number) =>
    req<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),

  // ---- files ----
  uploadFile: async (taskId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/files/upload?task_id=${taskId}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error("上传失败");
    return res.json() as Promise<Attachment>;
  },
  deleteAttachment: (id: number) =>
    req<{ ok: boolean }>(`/api/files/${id}`, { method: "DELETE" }),

  // ---- ai ----
  aiPresets: () => req<AIPreset[]>("/api/ai/presets"),
};
