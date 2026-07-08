export type Status = "todo" | "in-progress" | "done";
export type Priority = "high" | "medium" | "low";

export interface User {
  id: number;
  username: string;
  nickname: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "link" | "image" | "file" | "textarea";
}

export interface TaskType {
  id: number;
  owner_id: number | null;
  name: string;
  color: string;
  icon: string;
  is_builtin: boolean;
  field_defs: FieldDef[];
}

export interface Attachment {
  id: number;
  task_id: number;
  kind: "image" | "file";
  url: string;
  filename: string;
  size: number;
}

export interface Task {
  id: number;
  owner_id: number;
  type_id: number | null;
  title: string;
  link: string;
  conclusion: string;
  status: Status;
  priority: Priority;
  created_at: string;
  plan_start_date: string;
  plan_due_date: string;
  actual_done_at: string | null;
  reschedule_count: number;
  ext_fields: Record<string, unknown>;
  updated_at: string;
  attachments: Attachment[];
}

export type ViewMode = "week" | "month" | "custom";
export type CardDisplayMode = "default" | "typeColor";
// 跨天任务的甘特展示：lane=保留泳道条（超出转卡片） / card=全部作为带甘特标志的卡片
export type GanttMode = "lane" | "card";
// 无任务日期的弱化方式：dim=仅视觉弱化不改尺寸 / shrink=缩小格子高度
export type EmptyDayStyle = "dim" | "shrink";

export interface AIPreset {
  key: string;
  label: string;
  prompt: string;
}
