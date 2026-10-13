import { ITodoJSON } from "../../repositories/dto/todo-json";
import { Todo } from "../todo";
import { SnapshotPayload } from "./queue-item";

export type TodoAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'BULK_DELETE_COMPLETED'
  | 'BULK_DELETE_ALL';

export interface TodoSnapshotPayload extends SnapshotPayload<ITodoJSON> {}

export interface TodoPayload extends TodoSnapshotPayload {
  todo: Todo;
}

export interface TodoDeletePayload extends TodoSnapshotPayload {
}

export interface TodoBulkPayload extends TodoSnapshotPayload {
  userId: string;
}
