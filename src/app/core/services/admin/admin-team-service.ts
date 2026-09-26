import { Injectable, inject, Signal } from '@angular/core';
import { AdminTeamManager } from './admin-team-manager';
import { Department } from '../../models/department';
import { UserModel } from '../../models/user-model';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

@Injectable({
  providedIn: 'root'
})
export class AdminTeamService extends BaseDataManager {
  private adminDataManager = inject(AdminTeamManager);

  public readonly adminUsersSignal: Signal<UserModel[]> = this.adminDataManager.adminUsersSignal;

  public approveMember(userId: string, department: Department, role: string): void {
    this.adminDataManager.approveMember(userId, department, role);
  }

  public deleteMember(userId: string): void {
    this.adminDataManager.deleteAdminMember(userId);
  }

  // ==========================================
  // 🧹 BASE DATA MANAGER OVERRIDES
  // ==========================================

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    // UI-spezifischer Reset falls erforderlich
  }
}