import { SnapshotPayload } from "./queue-item";


export interface FocusPomodoroPayload extends SnapshotPayload {
  userId: string;  // Die User-ID
  todoId: string;  // Die ID des verknüpften Todos
  count: number;   // Das Pomodoro-Intervall 
}