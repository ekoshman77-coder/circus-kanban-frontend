export type TodoSyncState = 'fine' | 'dirty' | 'new';

export interface ITodoJSON {
  id: string;
  task: string;
  description: string | null;
  done: boolean;
  dueDate: number;
  completedAt: number | null;
  effort: number;
  usedEffort: number;
  createdAt: number;
  userId: string;
  syncState: TodoSyncState;
  category: string | null;
  effortChangesCount: number | null;
  milestoneId: string | null;
  assignedUserId?: string | null;
  isStarted: boolean;
  teamStatus: string; 
  // 🧠 UNSER NEUES TICKET-GEDÄCHTNIS (Synchron zum Kotlin-Backend!)
  lastDeveloperId?: string | null;
}