import { inject, Injectable, Signal } from '@angular/core';
import { TeamDataManager } from './team-data-manager';
import { UserModel } from '../../models/user-model';
import { ProjectMember } from '../../models/project-member';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

@Injectable({
  providedIn: 'root',
})
export class TeamService extends BaseDataManager {

  private dataManager = inject(TeamDataManager);

  // 👥 Globale Mitglieder-Liste für Admins / Team-Verwaltung
  public globalMembersSignal: Signal<ProjectMember[]> = this.dataManager.globalMembersSignal;

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
    // TeamService-spezifischer Reset (falls vorhanden)
  }
}