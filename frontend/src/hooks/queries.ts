import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Task, TaskType } from "../types";

export function useTypes(enabled = true) {
  return useQuery({ queryKey: ["types"], queryFn: api.listTypes, enabled });
}

export function useUsers(enabled = true) {
  return useQuery({ queryKey: ["users"], queryFn: api.listUsers, enabled });
}

export interface TaskQuery {
  view?: string;
  anchor?: string;
  custom_start?: string;
  custom_end?: string;
  q?: string;
  owner_id?: string;
}

export function useTasks(params: TaskQuery, enabled = true) {
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => api.listTasks(params as Record<string, string | undefined>),
    enabled,
  });
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const create = useMutation({ mutationFn: (d: Partial<Task>) => api.createTask(d), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) => api.updateTask(id, data),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.setStatus(id, status),
    onSuccess: invalidate,
  });
  const resetReschedule = useMutation({
    mutationFn: (id: number) => api.resetReschedule(id),
    onSuccess: invalidate,
  });
  const drag = useMutation({
    mutationFn: ({
      id,
      mode,
      start,
      due,
    }: {
      id: number;
      mode: "body" | "left" | "right";
      start?: string;
      due?: string;
    }) => api.dragTask(id, mode, start, due),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteTask(id), onSuccess: invalidate });

  return { create, update, setStatus, resetReschedule, drag, remove };
}

export function useTypeMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["types"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };
  const create = useMutation({ mutationFn: (d: Partial<TaskType>) => api.createType(d), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TaskType> }) => api.updateType(id, data),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteType(id), onSuccess: invalidate });
  return { create, update, remove };
}
