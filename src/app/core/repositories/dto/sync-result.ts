import { GamificationResult } from "../../models/gamification";
import { Todo } from "../../models/todo";

export interface SyncResult {
  liste: Todo[];
  gamificationResult: GamificationResult;
}