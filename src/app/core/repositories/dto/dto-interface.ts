import { GamificationResult } from "../../models/gamification";
import { StreakInfoDto } from "../../models/streak.info-dto";
import { ITodoJSON } from "./todo-json";

/**
 * 📦 Das exakte Gegenstück zur Kotlin 'TodoUpdateResponse'
 */
export interface TodoUpdateResponse {
  todo: ITodoJSON;                       // Das aktualisierte To-Do vom Server
  gamificationResult: GamificationResult | null; // Eventuelle XP (null, wenn sich 'done' nicht geändert hat)
  streakInfo: StreakInfoDto
}