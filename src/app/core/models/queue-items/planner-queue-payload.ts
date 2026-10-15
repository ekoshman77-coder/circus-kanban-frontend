import { SnapshotPayload } from "./queue-item";
import { RejectedTodoFeedback } from '../../repositories/ai-repository';

export interface PlannerFeedbackPayload extends SnapshotPayload {
  userId: string;
  roundId: string;
  acceptedTodoId: string | null;
  rejectedTodos: RejectedTodoFeedback[];
}

export interface SnoozePayload extends SnapshotPayload {
  // id entspricht der todoId!
  durationInMin: number;
}