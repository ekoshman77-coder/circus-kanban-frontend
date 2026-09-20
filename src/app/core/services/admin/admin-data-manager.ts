import { Injectable, inject, Signal } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { TeamRepository } from '../../repositories/team-repository';
import { UserRepository } from '../../repositories/user-repository';
import { Department } from '../../models/department';
import { UserModel } from '../../models/user-model';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import {
  AdminQueueAction,
  ApproveUserPayload,
  DeleteUserPayload
} from '../../models/queue-items/users-queue-payloads';
import { AdminStateProvider } from './admin-state-provider';

@Injectable({
  providedIn: 'root'
})
export class AdminDataManager extends BaseQueueDataManager {
  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository);

  constructor() {
    super('AdminDataManager');
    this.stateProvider.loadFromCache();
  }

  protected override createStateProvider(): AdminStateProvider {
    return new AdminStateProvider();
  }

  public get adminUsersSignal(): Signal<UserModel[]> {
    return this.getSignal() as Signal<UserModel[]>;
  }

  // ==========================================================================
  // ⚙️ QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as AdminQueueAction;

    switch (action) {
      case 'APPROVE_USER': {
        const payload = item.payload as ApproveUserPayload;
        return this.userRepository.approveUser(payload.id, payload.departmentId, payload.role);
      }
      case 'DELETE_USER': {
        const payload = item.payload as DeleteUserPayload;
        return this.userRepository.deleteGlobalUser$(payload.id);
      }
      default:
        return throwError(() => new Error(`[AdminDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    if (item.action === 'APPROVE_USER') {
      const payload = item.payload as ApproveUserPayload;
      if (payload.departmentId === localId) {
        payload.departmentId = serverId;
      }
    }
  }

  // ==========================================================================
  // 🔄 REHYDRATION PATTERN
  // ==========================================================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.teamRepository.getAllUsersForAdminBoard$().pipe(
      map((members): void => {
        const userModels = members.map((m) => m.user);
        this.stateProvider.applyActionPayload('SET_USERS', userModels);
      })
    );
  }

  // ==========================================================================
  // 🔄 AKTIONEN (Optimistic UI + Queue)
  // ==========================================================================

  public approveMember(userId: string, department: Department, role: string): void {
    const snapshot = this.stateProvider.createSnapshot();

    const payload: ApproveUserPayload = {
      id: userId,
      departmentId: department.id,
      role: role,
      snapshot
    };

    this.stateProvider.applyActionPayload('APPROVE_USER', payload);
    this.queueService.enqueue(this.serviceName, 'APPROVE_USER', payload);
  }

  public deleteAdminMember(memberId: string): void {
    const snapshot = this.stateProvider.createSnapshot();

    const payload: DeleteUserPayload = {
      id: memberId,
      snapshot
    };

    this.stateProvider.applyActionPayload('DELETE_USER', payload);
    this.queueService.enqueue(this.serviceName, 'DELETE_USER', payload);
  }

  // ==========================================================================
  // 🧹 BASE OVERRIDES
  // ==========================================================================

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.stateProvider.resetState();
  }

  // ==========================================================================
  // 🔗 DEPENDENCY & CHAIN EXTRACTION
  // ==========================================================================

  public override extractEntityIds(item: QueueItem): string[] {
    const ids = super.extractEntityIds(item);

    if (item.action === 'APPROVE_USER') {
      const payload = item.payload as ApproveUserPayload;
      if (payload.departmentId) {
        ids.push(payload.departmentId);
      }
    }

    return ids;
  }
}