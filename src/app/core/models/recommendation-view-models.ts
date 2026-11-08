import { RecommendedTodoItem } from "../services/ai/planner-service";

// Das saubere Domain-Model für die UI
export interface BlueprintViewSlot {
  startTime: string;
  endTime: string;
  energyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  recommendations: RecommendedTodoItem[]; // Enthält die echten Todos + PlannerDetails!
}

export interface DailyBlueprintViewModel {
  roundId: string;
  userId: string;
  generatedAtHour: number;
  slots: BlueprintViewSlot[];
}

export interface PlannerRecommendationViewModel {
  roundId: string;
  recommendations: RecommendedTodoItem[];
}