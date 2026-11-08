export interface PlannerRecommendationDetail {
  plannerType: 'BAYES' | 'NEURAL';
  score: number;
  reasonCode: string;
}

export interface PlannerRecommendationItem {
  todoId: string;
  plannerDetails: PlannerRecommendationDetail[];
  modeCode?: 'STANDARD' | 'ALL_SNOOZED';
}

export interface PlannerRecommendationsResponse {
  roundId: string;
  recommendations: PlannerRecommendationItem[];
}

export interface BlueprintSlotDto {
  startTime: string;
  endTime: string;
  energyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  recommendations: PlannerRecommendationItem[];
}

export interface DailyBlueprintResponse {
  roundId: string;
  userId: string;
  generatedAtHour: number;
  slots: BlueprintSlotDto[];
}