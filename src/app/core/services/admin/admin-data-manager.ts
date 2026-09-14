import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, map } from 'rxjs';
import { TeamRepository } from '../../repositories/team-repository';
import { IUser, UserRepository } from '../../repositories/user-repository';
import { Department } from '../../models/department';
import { UserModel } from '../../models/user-model';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { ApproveUserPayload, DeleteUserPayload } from '../../models/queue-items/users-queue-payloads';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';

export type AdminAction = 'APPROVE_USER' | 'DELETE_USER';

@Injectable({
  providedIn: 'root'
})
export class AdminDataManager extends BaseQueueDataManager {
  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository);

  public adminUsersSignal = signal<UserModel[]>([]);
  private readonly STORAGE_KEY_ADMIN_POOL = 'offline_admin_all_users';

  constructor() {
    super('AdminDataManager');
    this.loadAdminPoolFromCache();
  }

  // ==========================================================================
  // ⚙️ QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    switch (item.action as AdminAction) {
      case 'APPROVE_USER': {
        const payload = item.payload as ApproveUserPayload;
        return this.userRepository.approveUser(payload.id, payload.departmentId, payload.role);
      }
      case 'DELETE_USER': {
        const payload = item.payload as DeleteUserPayload;
        return this.userRepository.deleteGlobalUser$(payload.id);
      }
      default:
        return of(null);
    }
  }

  // ==========================================================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.teamRepository.getAllUsersForAdminBoard$().pipe(
      map((members): void => {
        const userModels = members.map((m) => m.user);
        this.adminUsersSignal.set(userModels);
        this.saveToCache(userModels);
      })
    );
  }

  public override resetState(snapshot: IUser[]): void {
    if (Array.isArray(snapshot)) {
      const restoredList = snapshot.map((json) => UserModel.fromJson(json));
      this.adminUsersSignal.set(restoredList);
      this.saveToCache(restoredList);
    }
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    // Admin-Aktionen führen nur Update/Delete aus
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    if (item.action === 'APPROVE_USER') {
      const payload = item.payload as ApproveUserPayload;
      // Wenn das genehmigte Department vorher die temporäre ID hatte, auf Server-ID biegen
      if (payload.departmentId === localId) {
        payload.departmentId = serverId;
      }
    }
  }

  // ==========================================================================
  // 🔄 AKTIONEN (Optimistic UI + Queue)
  // ==========================================================================

  public approveMember(userId: string, department: Department, role: string): void {
    const snapshot = this.createSnapshot();

    const updatedList = this.adminUsersSignal().map((user) => {
      if (user.id === userId) {
        return new UserModel({
          ...user,
          isApproved: true,
          department: department,
          departmentRole: role
        });
      }
      return user;
    });

    this.adminUsersSignal.set(updatedList);
    this.saveToCache(updatedList);

    const payload: ApproveUserPayload = {
      id: userId,
      departmentId: department.id,
      role: role,
      snapshot: snapshot
    };

    this.queueService.enqueue(this.serviceName, 'APPROVE_USER' as AdminAction, payload);
  }

  public deleteAdminMember(memberId: string): void {
    const snapshot = this.createSnapshot();

    const updatedList = this.adminUsersSignal().filter((user) => user.id !== memberId);
    this.adminUsersSignal.set(updatedList);
    this.saveToCache(updatedList);

    const payload: DeleteUserPayload = {
      id: memberId,
      snapshot: snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE_USER' as AdminAction, payload);
  }

  // ==========================================================================
  // 🧹 HILFSMETHODEN
  // ==========================================================================

  private createSnapshot(): IUser[] {
    return this.adminUsersSignal().map((user) => user.toJson());
  }

  private saveToCache(users: UserModel[]): void {
    const jsonPayload = users.map((u) => u.toJson());
    this.localStorageService.setItem(this.STORAGE_KEY_ADMIN_POOL, jsonPayload);
  }

  private loadAdminPoolFromCache(): void {
    const cached = this.localStorageService.getItem(this.STORAGE_KEY_ADMIN_POOL);
    if (cached && Array.isArray(cached)) {
      const hydrated = cached.map((json) => UserModel.fromJson(json));
      this.adminUsersSignal.set(hydrated);
    } else {
      this.adminUsersSignal.set([]);
    }
  }

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.localStorageService.removeItem(this.STORAGE_KEY_ADMIN_POOL);
  }
}