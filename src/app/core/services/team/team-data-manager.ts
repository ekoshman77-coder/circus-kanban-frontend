import { Injectable, inject, Signal } from '@angular/core';
import { Observable, throwError, map } from 'rxjs';
import { UserModel } from '../../models/user-model';
import { TeamRepository } from '../../repositories/team-repository';
import { ProjectMember } from '../../models/project-member';
import { UserRepository } from '../../repositories/user-repository';
import { UserService } from '../user/user-service';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import { CoffeePayload, CreateMemberPayload, DeleteMemberPayload, ProfilePayload, TeamAction } from '../../models/queue-items/member-queue-payload';
import { StateProvider } from '../central-queue/state-providers/base-state-provider';
import { TeamStateProvider } from './team-state-provider';

@Injectable({
  providedIn: 'root'
})
export class TeamDataManager extends BaseQueueDataManager {
  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository);
  private userService = inject(UserService);

  constructor() {
    super('TeamDataManager');
    this.loadInitialCache();
  }

  protected override createStateProvider(): StateProvider<ProjectMember[]> {
    return new TeamStateProvider();
  }

  public get globalMembersSignal(): Signal<ProjectMember[]> {
    return this.getSignal() as Signal<ProjectMember[]>;
  }

  // ==========================================================================
  // 🌍 MEMBER ACTIONS FOR UI
  // ==========================================================================

  public updateCoffeeAccount(userId: string, newBalance: number, role: string, emoji: string): void {
    const currentMembers = this.stateProvider.getState() as ProjectMember[];
    const updatedMember = currentMembers.find((m) => m.user.id === userId);
    if (!updatedMember || updatedMember.isPending) return;

    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('UPDATE_COFFEE', { id: userId, balance: newBalance, role, emoji });

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
    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('UPDATE_PROFILE', { id: updatedMember.id, updatedUser: updatedMember });

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
    const currentMembers = this.stateProvider.getState() as ProjectMember[];
    const member = currentMembers.find((m) => m.user.id === memberId);
    const userName = member ? member.user.fullName : 'Mitarbeiter';

    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('DELETE_MEMBER', { id: memberId });

    const payload: DeleteMemberPayload = {
      id: memberId,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE_MEMBER', payload);
    this.notificationService.showNotification(`🗑️ ${userName} wurde entfernt.`, 'info');
  }

  public createMember(member: UserModel, password: string, onError?: (errorMessage?: string) => void): void {
    const tempId = generateLocalId();
    const snapshot = this.stateProvider.createSnapshot();

    const newModel = new UserModel({
      id: tempId,
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      isApproved: null,
      department: null,
      projectIds: []
    });

    const newProjectMember = new ProjectMember(newModel, 'NONE');

    this.stateProvider.applyActionPayload('CREATE_MEMBER', { member: newProjectMember });

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
  // 🚀 BASE QUEUE DATA MANAGER HOOKS & QUEUE EXECUTION
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
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
        return throwError(() => new Error(`[TeamDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  protected override fetchFromServer(userId: string): Observable<void> {
    const currentUserId = userId || this.userService.getCurrentUserId() || '';
    return this.teamRepository.getAllDepartmentUsers$(currentUserId).pipe(
      map((members: ProjectMember[]): void => {
        this.stateProvider.applyActionPayload('SET_MEMBERS', { members });
      })
    );
  }
}