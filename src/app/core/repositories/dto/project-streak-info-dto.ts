export interface ProjectStreakInfoDto {
  projectId: string;
  streakDays: number;
  batteryPercentage: number;
  activeMembersCount: number;
  requiredMembersCount: number;
  todaysContributedMembers: number;
  todaysTotalEffort: number;
  activeShieldMembersCount: number;
  isShieldActive: boolean;
}