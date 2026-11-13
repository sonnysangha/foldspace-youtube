import type { FunctionReturnType } from 'convex/server';

import type { api } from '../../../convex/_generated/api';

export type CanvasItem = FunctionReturnType<typeof api.items.list>[number];
export type Task = { id: string; text: string; done: boolean };

export function newTaskId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
