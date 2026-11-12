import { SnapshotPayload } from "./queue-item";

export type PlannerQueueAction = 'SEND_FEEDBACK' | 'SNOOZE_TODO' | 'RETRAIN_AI';

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

export interface RetrainPlannerPayload extends SnapshotPayload {
  // Keine weiteren Spezialfelder nötig, da der Endpunkt parameterlos ist
}