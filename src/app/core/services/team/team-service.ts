import { inject, Injectable, Signal } from '@angular/core';
import { TeamDataManager } from './team-data-manager';
import { UserModel } from '../../models/user-model';
import { UserService } from '../user/user-service';
import { ProjectMember } from '../../models/project-member';
import { PermissionService, UIActionIntent } from '../permissions/permission-service';
import { ProjectService } from '../project/project-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

@Injectable({
  providedIn: 'root',
})
export class TeamService extends BaseDataManager {

  private dataManager = inject(TeamDataManager);
  private userService = inject(UserService);
  private permissionService = inject(PermissionService);
  private projectService = inject(ProjectService);

  public globalMembersSignal: Signal<ProjectMember[]> = this.dataManager.globalMembersSignal;
  
  // Reicht das Projektmitglieder-Signal direkt aus dem ProjectService durch
  public currentProjectMembersSignal: Signal<ProjectMember[]> = this.projectService.currentProjectMembersSignal;

  public setCurrentProject(projectId: string | null): void {
    this.projectService.setActiveProjectId(projectId);
  }

  /** 🛡️ Universelle Rechte-Prüfung */
  public hasPermission(projectId: string | null, action: UIActionIntent): boolean {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId || !projectId) return false;

    const currentProject = this.projectService.projectsList().find(p => p.id === projectId);
    if (!currentProject) return false;

    const members = this.currentProjectMembersSignal();
    const myBinding = members.find(m => m.user.id === currentUserId);

    const isOwner = currentProject.userId === currentUserId;

    return this.permissionService.canUserPerformAction(action, {
      isOwner: isOwner,
      contextRole: myBinding?.projectRole,
      systemRole: this.userService.currentUser()?.departmentRole ?? ""
    });
  }

  public updateMember(updatedMember: UserModel): void {
    this.dataManager.updateGlobalMember(updatedMember);
  }

  public updateCoffeeAccount(userId: string, newBalance: number, role: string, emoji: string): void {
    this.dataManager.updateCoffeeAccount(userId, newBalance, role, emoji);
  }

  public deleteMember(projectId: string | null, id: string): void {
    this.dataManager.deleteGlobalMember(id);
  }

  public createMember(member: UserModel, password: string, onError?: (errorMessage?: string) => void): void {
    this.dataManager.createMember(member, password, onError);
  }

  public resetData(): void {
    this.projectService.setActiveProjectId(null);
  }
}