export interface PlannerRecommendationRequest {
  userId: string;
  userEnergy: 'LOW' | 'MEDIUM' | 'HIGH';
  workingTimeLeft: number;
}