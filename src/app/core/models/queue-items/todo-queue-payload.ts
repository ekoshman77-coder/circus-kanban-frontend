import { ISanitizationFeedbackDTO } from "../../repositories/dto/senisitive-feedback-dto";
import { ITodoJSON } from "../../repositories/dto/todo-json";
import { SanitizationFeedback } from "../sanitiziation-feedback";
import { Todo } from "../todo";
import { SnapshotPayload } from "./queue-item";

export type TodoAction =
  | 'SET_TODOS' 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'BULK_DELETE_COMPLETED'
  | 'BULK_DELETE_ALL'
  | 'RESTORE'
  | 'SANITIZE_FEEDBACK';

export interface TodoSnapshotPayload extends SnapshotPayload<ITodoJSON> {}

export interface TodoPayload extends TodoSnapshotPayload {
  todo: Todo;
}

export interface TodoDeletePayload extends TodoSnapshotPayload {
}

export interface TodoBulkPayload extends TodoSnapshotPayload {
  userId: string;
}

export interface SanitizationFeedbackPayload extends SnapshotPayload {
  feedbackDto: SanitizationFeedback;
}