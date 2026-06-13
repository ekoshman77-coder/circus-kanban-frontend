import { GamificationResult } from "../../models/gamification";
import { ITodoJSON } from "./todo-json";

/**
 * 📦 Das exakte Gegenstück zur Kotlin 'TodoUpdateResponse'
 */
export interface TodoUpdateResponse {
  todo: ITodoJSON;                       // Das aktualisierte To-Do vom Server
  gamificationResult: GamificationResult | null; // Eventuelle XP (null, wenn sich 'done' nicht geändert hat)
}