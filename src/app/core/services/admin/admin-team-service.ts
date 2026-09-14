import { Injectable, inject, Signal } from '@angular/core';
import { AdminDataManager } from './admin-data-manager';
import { ProjectMember } from '../../models/project-member';
import { Department } from '../../models/department';

@Injectable({
  providedIn: 'root'
})
export class AdminTeamService {
  private adminDataManager = inject(AdminDataManager);

  // Reicht das saubere Admin-Signal weiter
  public adminUsersSignal = this.adminDataManager.adminUsersSignal;

  public approveMember(userId: string, department: Department, role: string): void {
    this.adminDataManager.approveMember(userId, department, role);
  }

  public deleteMember(userId: string): void {
    this.adminDataManager.deleteAdminMember(userId);
  }
}