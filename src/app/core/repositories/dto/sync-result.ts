import { GamificationResult } from "../../models/gamification";
import { StreakInfoDto } from "../../models/streak.info-dto";
import { Todo } from "../../models/todo";

export interface SyncResult {
  liste: Todo[];
  gamificationResult: GamificationResult;
  streakInfo: StreakInfoDto
}