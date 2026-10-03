import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { TeamDataManager } from './team-data-manager';
import { TeamRepository } from '../../repositories/team-repository';
import { UserRepository } from '../../repositories/user-repository';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';
import { NotificationService } from '../notification/notification-service';
import { CentralQueueService } from '../central-queue/central-queue-service';
import { IUserInit, UserModel } from '../../models/user-model';
import { ProjectMember } from '../../models/project-member';
import { of } from 'rxjs';
import { setupLocalStorageMock } from '../../../../../tests/helpers/local-storage-mock';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('TeamDataManager (Vitest - Strictly Typed)', () => {
  let manager: TeamDataManager;

  // 🏭 Helper-Factory für unkomplizierte UserModel-Erstellung in Tests
  const createTestUser = (overrides: Partial< IUserInit > = {}): UserModel => {
    return new UserModel({
      id: 'user-123',
      username: 'testuser',
      firstName: 'Max',
      lastName: 'Mustermann',
      department: null,
      isApproved: true,
      projectIds: [],
      ...overrides
    });
  };

  // Mocks mit echten Typ-Schnittstellen
  let teamRepoMock: Partial< TeamRepository >;
  let userRepoMock: Partial< UserRepository >;
  let connectionServiceMock: Partial< ConnectionService >;
  let userServiceMock: Partial< UserService >;
  let notificationServiceMock: Partial< NotificationService >;
  let centralQueueServiceMock: Partial< CentralQueueService >;

  let isOnlineSignal: WritableSignal< boolean >;

  beforeEach(() => {
    setupLocalStorageMock();
    isOnlineSignal = signal< boolean >(false);

    teamRepoMock = {
      getMembersForProject$: vi.fn().mockReturnValue(of([])),
      getAllDepartmentUsers$: vi.fn().mockReturnValue(of([])),
      assignToProject$: vi.fn().mockReturnValue(of(null)),
      deleteFromProject$: vi.fn().mockReturnValue(of(null)),
      updateCoffeeAccount$: vi.fn().mockReturnValue(of(null))
    };

    userRepoMock = {
      updateProfile$: vi.fn().mockReturnValue(of(null)),
      deleteGlobalUser$: vi.fn().mockReturnValue(of(null)),
      createUser: vi.fn().mockReturnValue(of({ id: 'new-id', username: 'newuser', firstName: 'New', lastName: 'User' }))
    };

    connectionServiceMock = {
      isOnline: isOnlineSignal
    };

    userServiceMock = {
      getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    notificationServiceMock = {
      showNotification: vi.fn()
    };

    centralQueueServiceMock = {
      enqueue: vi.fn(),
      registerService: vi.fn()
    };

    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        TeamDataManager,
        { provide: TeamRepository, useValue: teamRepoMock },
        { provide: UserRepository, useValue: userRepoMock },
        { provide: ConnectionService, useValue: connectionServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: CentralQueueService, useValue: centralQueueServiceMock }
      ]
    });

    isOnlineSignal.set(false);
  });

  it('sollte Kaffeekassen-Änderungen über die State-Provider-Pipeline und Queue verarbeiten', () => {
    manager = TestBed.inject(TeamDataManager);

    const initialUser = createTestUser({ id: 'u-coffee', firstName: 'Coffee', lastName: 'Lover' });
    const initialMember = new ProjectMember(initialUser, 'DEVELOPER');

    // Wir simulieren initial geladene Mitglieder über den StateProvider des DataManagers
    (manager as any).stateProvider.applyActionPayload('SET_MEMBERS', { members: [initialMember] });

    // Ausführung
    manager.updateCoffeeAccount('u-coffee', 25.00, 'Barista', '☕');

    // Auswertung: Lokales Signal sofort aktualisiert
    const updatedMember = manager.globalMembersSignal().find(m => m.user.id === 'u-coffee');
    expect(updatedMember?.user.coffeeAccount.balance).toBe(25.00);
    expect(updatedMember?.user.coffeeAccount.role).toBe('Barista');

    // Auswertung: Event in Queue eingereiht
    expect(centralQueueServiceMock.enqueue).toHaveBeenCalledWith(
      expect.any(String),
      'UPDATE_COFFEE',
      expect.objectContaining({
        id: 'u-coffee',
        balance: 25.00,
        role: 'Barista',
        emoji: '☕'
      })
    );
  });

  it('sollte ein Mitglied optimistisch aus dem Signal entfernen und in Queue pushen', () => {
    manager = TestBed.inject(TeamDataManager);

    const memberToDelete = new ProjectMember(createTestUser({ id: 'u-delete' }), 'DEVELOPER');
    (manager as any).stateProvider.applyActionPayload('SET_MEMBERS', { members: [memberToDelete] });

    manager.deleteGlobalMember('u-delete');

    expect(manager.globalMembersSignal().length).toBe(0);
    expect(centralQueueServiceMock.enqueue).toHaveBeenCalledWith(
      expect.any(String),
      'DELETE_MEMBER',
      expect.objectContaining({ id: 'u-delete' })
    );
  });
});