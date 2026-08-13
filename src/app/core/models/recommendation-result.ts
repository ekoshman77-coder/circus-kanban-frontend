export type RejectReason = 'no_motivation' | 'too_heavy' | 'too_long' | 'snooze';

// 📦 Ein einziges sauberes Ergebnis-Paket für den PlannerService!
export interface RecommendationResult {
  selectedTodoId?: string;
  rejections: { todoId: string; reason: RejectReason }[];
}