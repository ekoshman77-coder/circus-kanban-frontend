import { TestBed } from '@angular/core/testing';
import { computed, signal, WritableSignal } from '@angular/core';
import { TeamDataManager } from './team-data-manager';
import { TeamRepository } from '../../repositories/team-repository';
import { UserRepository } from '../../repositories/user-repository';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';
import { NotificationService } from '../notification/notification-service';
import { IUserInit, UserModel } from '../../models/user-model';
import { ProjectMember } from '../../models/project-member';
import { of } from 'rxjs';
import { setupLocalStorageMock } from '../../shared/test-utils/local-storage-mock';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('TeamDataManager (Vitest - Strictly Typed)', () => {
  let manager: TeamDataManager;

  // 🏭 Helper-Factory für unkomplizierte UserModel-Erstellung in Tests
  const createTestUser = (overrides: Partial<IUserInit> = {}): UserModel => {
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

  // Mocks mit echten Typ-Schnittstellen (Kein `any` mehr!)
  let teamRepoMock: Partial<TeamRepository>;
  let userRepoMock: Partial<UserRepository>;
  let connectionServiceMock: Partial<ConnectionService>;
  let userServiceMock: Partial<UserService>;
  let notificationServiceMock: Partial<NotificationService>;

  // Reaktives Signal für den Online-Status
  let isOnlineSignal: WritableSignal<boolean>;

  beforeEach(() => {
    setupLocalStorageMock();
    isOnlineSignal = signal<boolean>(false);

    // 🎯 Typsichere Mocks aufbauen
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

    let connectionServiceMock: Partial<ConnectionService> = {
      isOnline: isOnlineSignal
    };

    userServiceMock = {
      getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    notificationServiceMock = {
      showNotification: vi.fn()
    };

    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        TeamDataManager,
        { provide: TeamRepository, useValue: teamRepoMock },
        { provide: UserRepository, useValue: userRepoMock },
        { provide: ConnectionService, useValue: connectionServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock }
      ]
    });

    isOnlineSignal.set(false);
  });

  it('sollte beim Erstellen globale Mitglieder aus dem Cache laden', () => {
    const cachedUser = createTestUser({ id: 'u1', firstName: 'Elena', username: 'elena_dev' });
    const fakeCachedMembers = [
      {
        user: cachedUser.toJson(),
        projectRole: 'OWNER'
      }
    ];
    localStorage.setItem('offline_global_members', JSON.stringify(fakeCachedMembers));

    manager = TestBed.inject(TeamDataManager);

    const globalMembers = manager.globalMembersSignal();
    expect(globalMembers.length).toBe(1);
    expect(globalMembers[0].user.firstName).toBe('Elena');
    expect(globalMembers[0].projectRole).toBe('OWNER');
  });

  it('sollte im Offline-Modus Daten aus dem Projekt-Cache laden, falls vorhanden', () => {
    manager = TestBed.inject(TeamDataManager);
    const projectId = 'project-abc';
    const cacheKey = `offline_project_members_${projectId}`;

    const cachedUser = createTestUser({ id: 'u2', firstName: 'Max', username: 'max_design', projectIds: ['project-abc'] });
    const fakeProjectMembers = [
      {
        user: cachedUser.toJson(),
        projectRole: 'DEVELOPER'
      }
    ];
    localStorage.setItem(cacheKey, JSON.stringify(fakeProjectMembers));

    manager.loadProjectMembers(projectId);

    expect(manager.isProjectOfflineAvailable()).toBe(true);
    expect(manager.currentProjectMembersSignal().length).toBe(1);
    expect(manager.currentProjectMembersSignal()[0].user.firstName).toBe('Max');
    expect(teamRepoMock.getMembersForProject$).not.toHaveBeenCalled();
  });

  it('sollte das Flag isProjectOfflineAvailable auf false setzen, wenn Projekt offline fehlt', () => {
    manager = TestBed.inject(TeamDataManager);
    const projectId = 'unbekanntes-projekt';

    manager.loadProjectMembers(projectId);

    expect(manager.isProjectOfflineAvailable()).toBe(false);
    expect(manager.currentProjectMembersSignal().length).toBe(0);
  });

  it('sollte bei addMemberToProject sofort die Optimistic UI bedienen (Signal und Cache)', () => {
    manager = TestBed.inject(TeamDataManager);
    const projectId = 'proj-1';
    const newUser = createTestUser({ id: 'u3', username: 'newbie', firstName: 'Tom', lastName: 'Tester' });

    manager.addMemberToProject(projectId, newUser, 'DEVELOPER');

    const members = manager.currentProjectMembersSignal();
    expect(members.length).toBe(1);
    expect(members[0].user.firstName).toBe('Tom');
    expect(members[0].projectRole).toBe('DEVELOPER');

    const cached = localStorage.getItem(`offline_project_members_${projectId}`);
    expect(cached).toBeTruthy();
    expect(JSON.parse(cached!).length).toBe(1);
  });

  it('sollte im Offline-Modus Kaffeekassen-Änderungen lokal durchführen und in Queue pushen', () => {
    manager = TestBed.inject(TeamDataManager);

    // Vorbereitung: Ein User im globalen Signal vorhalten
    const initialUser = createTestUser({ id: 'u-coffee' });
    manager.globalMembersSignal.set([new ProjectMember(initialUser, 'DEVELOPER')]);

    // Ausführung
    manager.updateCoffeeAccount('u-coffee', 25.00, 'Barista', '☕');

    // Auswertung: Lokales Signal sofort aktualisiert
    const updatedMember = manager.globalMembersSignal().find(m => m.user.id === 'u-coffee');
    expect(updatedMember?.user.coffeeAccount.balance).toBe(25.00);
    expect(updatedMember?.user.coffeeAccount.role).toBe('Barista');

    // Auswertung: In Queue abgelegt
    const queuedActions = localStorage.getItem('offline_team_actions_queue');
    expect(queuedActions).toBeTruthy();
    expect(JSON.parse(queuedActions!)[0].type).toBe('UPDATE_COFFEE');
  });
});