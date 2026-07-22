// Das schicken wir ans Backend (Passend zum TodoStatusUpdateDto in Kotlin)
export interface TodoStatusUpdatePayload {
  userId: string;
  isDone: boolean;
}

// Das kommt vom GamificationService zurück (Passend zum GamificationResult)
export interface GamificationResult {
  currentXp: number;
  currentLevel: number;
  levelUp: boolean;
  levelTitle: string;
  levelIcon: string;
  currentLevelXpStart: number;
  nextLevelXpRequired: number;
}