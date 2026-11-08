import { PlannerRecommendationDetail } from "../repositories/dto/planner-recommendation-response";
import { Todo } from "./todo";

export interface RecommendedTodoItem {
  todo: Todo;
  plannerDetails: PlannerRecommendationDetail[];
  modeCode: 'STANDARD' | 'ALL_SNOOZED';
}

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