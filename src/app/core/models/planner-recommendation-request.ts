export interface PlannerRecommendationRequest {
  userId: string;
  userEnergy: 'low' | 'normal' | 'high';
  workingTimeLeft: number;
}