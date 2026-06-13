export type TodoSyncState = 'fine' | 'dirty' | 'new';

export interface ITodoJSON {
  id: string;
  task: string;
  description: string | null;      // Kann jetzt auch null sein
  done: boolean;
  dueDate: number;
  completedAt: number | null;     // Explizit number oder null
  effort: number;
  usedEffort: number;
  createdAt: number;
  userId: string;
  syncState: TodoSyncState,
  category: string | null
   effortChangesCount: number | null;
   milestoneId: string | null;
   assignedUserId?: string | null;
   isStarted: boolean;
}