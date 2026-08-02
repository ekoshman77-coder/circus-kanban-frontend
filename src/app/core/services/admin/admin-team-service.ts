import { Injectable, inject, Signal } from '@angular/core';
import { AdminDataManager } from './admin-data-manager';
import { ProjectMember } from '../../models/project-member';

@Injectable({
  providedIn: 'root'
})
export class AdminTeamService {
  private adminDataManager = inject(AdminDataManager);

  // Reicht das saubere Admin-Signal weiter
  public adminUsersSignal: Signal<ProjectMember[]> = this.adminDataManager.adminUsersSignal;

  public loadAdminPool(): void {
    this.adminDataManager.loadAdminBoardPool();
  }

  public approveMember(userId: string, departmentId: string): void {
    this.adminDataManager.approveAdminMember(userId, departmentId);
  }

  public deleteMember(userId: string): void {
    this.adminDataManager.deleteAdminMember(userId);
  }
}