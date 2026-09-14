import { Injectable, inject, signal } from '@angular/core';
import { Observable, throwError, map } from 'rxjs';
import { UserModel } from '../../models/user-model';
import { TeamRepository } from '../../repositories/team-repository';
import { ProjectMember } from '../../models/project-member';
import { UserRepository } from '../../repositories/user-repository';
import { UserService } from '../user/user-service';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import {
  CoffeePayload,
  CreateMemberPayload,
  DeleteMemberPayload,
  ProfilePayload
} from '../../models/queue-items/member-queue-payload';

export type TeamAction = 'UPDATE_COFFEE' | 'UPDATE_PROFILE' | 'DELETE_MEMBER' | 'CREATE_MEMBER';

@Injectable({
  providedIn: 'root'
})
export class TeamDataManager extends BaseQueueDataManager {

  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository);
  private userService = inject(UserService);

  public globalMembersSignal = signal< ProjectMember[]>([]);
  private readonly STORAGE_KEY_GLOBAL = 'offline_global_members';

  constructor() {
    super('TeamDataManager');
    this.loadGlobalMembersFromCache();
  }

  // ==========================================================================
  // 🚀 BASE QUEUE DATA MANAGER HOOKS
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable< any> {
    const action = item.action as TeamAction;
    const payload = item.payload;

    switch (action) {
      case 'UPDATE_COFFEE': {
        const coffeePayload = payload as CoffeePayload;
        return this.teamRepository.updateCoffeeAccount$(
          coffeePayload.id,
          coffeePayload.balance,
          coffeePayload.role,
          coffeePayload.emoji
        );
      }
      case 'UPDATE_PROFILE': {
        const profilePayload = payload as ProfilePayload;
        return this.userRepository.updateProfile$(
          profilePayload.id,
          profilePayload.username,
          profilePayload.firstName,
          profilePayload.lastName
        );
      }
      case 'DELETE_MEMBER': {
        const deletePayload = payload as DeleteMemberPayload;
        return this.userRepository.deleteGlobalUser$(deletePayload.id);
      }
      case 'CREATE_MEMBER': {
        const createPayload = payload as CreateMemberPayload;
        return this.userRepository.createUser({
          username: createPayload.username,
          firstName: createPayload.firstName,
          lastName: createPayload.lastName,
          password: createPayload.password || ''
        });
      }
      default:
        return throwError((): Error => new Error(`[TeamDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override resetState(snapshot: unknown[]): void {
    if (Array.isArray(snapshot)) {
      const restored = snapshot.map(
        (m: any) => new ProjectMember(UserModel.fromJson(m.user), m.projectRole)
      );
      this.globalMembersSignal.set(restored);
      this.saveToCache(restored);
    }
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    const serverUser = response as { id: string };
    const updatedList = this.globalMembersSignal().map((m) => {
      if (m.user.id === tempId) {
        m.user.id = serverUser.id;
      }
      return m;
    });

    this.globalMembersSignal.set(updatedList);
    this.saveToCache(updatedList);
  }

  // ==========================================================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================================================

  protected override fetchFromServer(userId: string): Observable< void> {
    const currentUserId = userId || this.userService.getCurrentUserId() || '';
    return this.teamRepository.getAllDepartmentUsers$(currentUserId).pipe(
      map((members: ProjectMember[]): void => {
        this.globalMembersSignal.set(members);
        this.saveToCache(members);
      })
    );
  }

  // ==========================================================================
  // 🌍 MEMBER ACTIONS
  // ==========================================================================

  public updateCoffeeAccount(userId: string, newBalance: number, role: string, emoji: string): void {
    const updatedMember = this.globalMembersSignal().find((user) => user.user.id === userId);
    if (!updatedMember || updatedMember.isPending) return;

    const snapshot = this.getSnapshotJson();
    const updatedList = this.globalMembersSignal().map((m) => {
      if (m.user.id === userId) {
        m.user.coffeeAccount = { balance: newBalance, role, emoji };
      }
      return m;
    });

    this.globalMembersSignal.set(updatedList);
    this.saveToCache(updatedList);

    const payload: CoffeePayload = {
      id: userId,
      balance: newBalance,
      role,
      emoji,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'UPDATE_COFFEE', payload);
  }

  public updateGlobalMember(updatedMember: UserModel): void {
    const snapshot = this.getSnapshotJson();
    const updatedList = this.globalMembersSignal().map((m) => {
      if (m.user.id === updatedMember.id) return new ProjectMember(updatedMember, m.projectRole);
      return m;
    });

    this.globalMembersSignal.set(updatedList);
    this.saveToCache(updatedList);

    const payload: ProfilePayload = {
      id: updatedMember.id,
      username: updatedMember.username,
      firstName: updatedMember.firstName,
      lastName: updatedMember.lastName,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'UPDATE_PROFILE', payload);
  }

  public deleteGlobalMember(memberId: string): void {
    const snapshot = this.getSnapshotJson();
    const user = this.globalMembersSignal().map((m) => m.user).find((u) => u.id === memberId);
    const userName = user ? `\({user.firstName}\){user.lastName}` : 'Mitarbeiter';

    const updatedList = this.globalMembersSignal().filter((m) => m.user.id !== memberId);
    this.globalMembersSignal.set(updatedList);
    this.saveToCache(updatedList);

    const payload: DeleteMemberPayload = {
      id: memberId,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE_MEMBER', payload);
    this.notificationService.showNotification(`🗑️ ${userName} wurde entfernt.`, 'info');
  }

  public createMember(member: UserModel, password: string, onError?: (errorMessage?: string) => void): void {
    const tempId = generateLocalId();
    const snapshot = this.getSnapshotJson();

    const newModel = new UserModel({
      id: tempId,
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      isApproved: null,
      department: null,
      projectIds: []
    });

    const updatedList = [...this.globalMembersSignal(), new ProjectMember(newModel, 'NONE')];
    this.globalMembersSignal.set(updatedList);
    this.saveToCache(updatedList);

    const payload: CreateMemberPayload = {
      id: tempId,
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      password,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'CREATE_MEMBER', payload);
    if (onError) onError();
  }

  // ==========================================================================
  // 🛠️ PRIVATE CACHE & SNAPSHOT HELPER
  // ==========================================================================

  private getSnapshotJson(): any[] {
    return this.globalMembersSignal().map((m) => ({
      user: m.user.toJson(),
      projectRole: m.projectRole
    }));
  }

  private saveToCache(members: ProjectMember[]): void {
    const raw = members.map((m) => ({
      user: m.user.toJson(),
      projectRole: m.projectRole
    }));
    this.localStorageService.setItem(this.STORAGE_KEY_GLOBAL, raw);
  }

  private loadGlobalMembersFromCache(): void {
    const cached = this.localStorageService.getItem< any[]>(this.STORAGE_KEY_GLOBAL);
    if (cached && Array.isArray(cached)) {
      const hydrated = cached.map((m) => new ProjectMember(UserModel.fromJson(m.user), m.projectRole));
      this.globalMembersSignal.set(hydrated);
    }
  }

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.globalMembersSignal.set([]);
    this.localStorageService.removeItem(this.STORAGE_KEY_GLOBAL);
  }
}