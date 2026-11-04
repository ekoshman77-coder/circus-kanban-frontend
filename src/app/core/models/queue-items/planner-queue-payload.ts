import { SnapshotPayload } from "./queue-item";
import { RejectedTodoFeedback } from '../../repositories/ai-repository';

export interface TodoFeedbackItem {
  todoId: string;
  reason: string | null; // z. B. "motivation", "effort", "time" oder Ablehnungsgründe
}

export interface PlannerFeedbackPayload extends SnapshotPayload {
  userId: string;
  roundId: string;
  acceptedTodo: TodoFeedbackItem | null; // 🟢 Jetzt ein Objekt mit ID und optionalem Grund!
  rejectedTodos: TodoFeedbackItem[];    // 🔴 Nutzt exakt dieselbe Struktur
}

export interface SnoozePayload extends SnapshotPayload {
  // id entspricht der todoId!
  durationInMin: number;
}