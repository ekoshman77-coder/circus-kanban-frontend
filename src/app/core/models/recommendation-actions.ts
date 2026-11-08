export type AcceptReason = 'select_easy' | 'select_ontime' | 'select_motivated' | 'select_important';
export type RejectReason = 'no_motivation' | 'too_heavy' | 'too_long' | 'snooze';

export interface AcceptAction {
  roundId: string;
  todoId: string;
  reason?: AcceptReason;
}

export interface RejectAction {
  roundId: string;
  todoId: string;
  reason: RejectReason;
}

export interface SnoozeAction {
  todoId: string;
  durationInMin: number;
}