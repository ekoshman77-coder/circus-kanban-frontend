import { ProjectStreakInfoDto } from "../repositories/dto/project-streak-info-dto";

export class ProjectStreakInfo {
  projectId: string;
  streakDays: number;
  batteryPercentage: number;
  activeMembersCount: number;
  requiredMembersCount: number;
  todaysContributedMembers: number;
  todaysTotalEffort: number;
  activeShieldMembersCount: number;
  isShieldActive: boolean;

  constructor(init: {
  projectId: string;
  streakDays: number;
  batteryPercentage: number;
  activeMembersCount: number;
  requiredMembersCount: number;
  todaysContributedMembers: number;
  todaysTotalEffort: number;
  activeShieldMembersCount: number;
  isShieldActive: boolean;
}) {
    this.projectId = init.projectId
    this.streakDays = init.streakDays
    this.batteryPercentage = init.batteryPercentage
    this.activeMembersCount = init.activeMembersCount
    this.requiredMembersCount = init.requiredMembersCount
    this.todaysContributedMembers = init.todaysContributedMembers
    this.todaysTotalEffort = init.todaysTotalEffort
    this.activeShieldMembersCount = init.activeShieldMembersCount
    this.isShieldActive  = init.isShieldActive
  }

  public static fromJson(json: ProjectStreakInfoDto): ProjectStreakInfo {
    return new ProjectStreakInfo({
            projectId: json.projectId,
            streakDays: json.streakDays,
            batteryPercentage: json.batteryPercentage,
            activeMembersCount: json.activeMembersCount,
            requiredMembersCount: json.requiredMembersCount,
            todaysContributedMembers: json.todaysContributedMembers,
            todaysTotalEffort: json.todaysTotalEffort,
            activeShieldMembersCount: json.activeShieldMembersCount,
            isShieldActive: json.isShieldActive
    })
  }
}