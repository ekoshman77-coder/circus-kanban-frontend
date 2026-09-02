import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { TeamService } from './team-service';
import { TeamDataManager } from './team-data-manager';
import { UserService } from '../user/user-service';
import { PermissionService } from '../permissions/permission-service';
import { IUserInit, UserModel } from '../../models/user-model';
import { ProjectMember } from '../../models/project-member';
import { ProjectAction } from '../../enums/project-action-enum';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('TeamService (Vitest - Strict Typing)', () => {
  let service: TeamService;

  const createTestUser = (overrides: Partial<IUserInit> = {}): UserModel => {
    return new UserModel({
      id: 'user-active',
      username: 'testuser',
      firstName: 'Max',
      lastName: 'Mustermann',
      department: null,
      isApproved: true,
      projectIds: [],
      ...overrides
    });
  };
  
  // 🛡️ Typisierte Signals & Mocks
  let globalMembersSignalMock: WritableSignal<ProjectMember[]>;
  let currentProjectMembersSignalMock: WritableSignal<ProjectMember[]>;

  // Interfaces statt `any`
  let dataManagerMock: Partial<TeamDataManager>;
  let userServiceMock: Partial<UserService>;
  let permissionServiceMock: Partial<PermissionService>;

  beforeEach(() => {
    globalMembersSignalMock = signal<ProjectMember[]>([]);
    currentProjectMembersSignalMock = signal<ProjectMember[]>([]);

    // 🎯 Typsicherer DataManager-Mock
    dataManagerMock = {
      globalMembersSignal: globalMembersSignalMock,
      currentProjectMembersSignal: currentProjectMembersSignalMock,
      loadProjectMembers: vi.fn(),
      loadGlobalMembers: vi.fn(),
      addMemberToProject: vi.fn(),
      removeMemberFromProject: vi.fn(),
      updateGlobalMember: vi.fn(),
      updateCoffeeAccount: vi.fn(),
      deleteGlobalMember: vi.fn(),
      createMember: vi.fn()
    };

    // 🎯 Typsicherer UserService-Mock
    userServiceMock = {
      getCurrentUserId: vi.fn().mockReturnValue('user-active')
    };

    // 🎯 Typsicherer PermissionService-Mock
    permissionServiceMock = {
      allPermissions: signal([]),
      hasPermission: vi.fn((role: string, action: ProjectAction) => {
        if (role === 'OWNER') return true;
        if (role === 'DEVELOPER' && action === 'TODO_CREATE') return true;
        if (role === 'DEVELOPER' && action === 'PROJECT_DELETE') return false;
        return false;
      })
    };

    TestBed.configureTestingModule({
      providers: [
        TeamService,
        { provide: TeamDataManager, useValue: dataManagerMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: PermissionService, useValue: permissionServiceMock }
      ]
    });

    service = TestBed.inject(TeamService);
    
    globalMembersSignalMock.set([]);
    currentProjectMembersSignalMock.set([]);
  });

  it('sollte bei setCurrentProject die ID setzen und den DataManager zum Laden triggern', () => {
    const projectId = 'project-123';

    service.setCurrentProject(projectId);

    expect(service.currentProjectId()).toBe(projectId);
    expect(dataManagerMock.loadProjectMembers).toHaveBeenCalledWith(projectId);
  }); 

  describe('Rechteprüfung (hasPermission)', () => {
    it('sollte false zurückgeben, wenn keine Projektmitglieder geladen sind', () => {
      expect(service.hasPermission('project-123', 'PROJECT_EDIT' as ProjectAction)).toBe(false);
    });

    it('sollte true zurückgeben, wenn ein OWNER das Projekt löschen möchte', () => {
      const activeUser = createTestUser({ id: 'user-active', username: 'elena', firstName: 'E', lastName: 'L', projectIds: ['project-123'] });
      currentProjectMembersSignalMock.set([
        new ProjectMember(activeUser, 'OWNER')
      ]);

      expect(service.hasPermission('project-123', 'PROJECT_DELETE' as ProjectAction)).toBe(true);
      expect(service.hasPermission('project-123', 'MILESTONE_CREATE' as ProjectAction)).toBe(true);
    });

    it('sollte false zurückgeben, wenn ein DESIGNER versucht ein Projekt zu löschen', () => {
      const activeUser = createTestUser({ id: 'user-active', username: 'designer-guy', firstName: 'D', lastName: 'G', projectIds: ['project-123'] });
      currentProjectMembersSignalMock.set([
        new ProjectMember(activeUser, 'DEVELOPER')
      ]);

      expect(service.hasPermission('project-123', 'PROJECT_DELETE' as ProjectAction)).toBe(false);
      expect(service.hasPermission('project-123', 'TODO_CREATE' as ProjectAction)).toBe(true);
    });
  });

  it('sollte addMemberToProject transparent an den DataManager weiterreichen', () => {
    const projectId = 'proj-99';
    const fakeUser = createTestUser({ id: 'u-9', username: 'test', firstName: 'A', lastName: 'B', projectIds: [] });

    service.addMemberToProject(projectId, fakeUser, 'DEVELOPER');

    expect(dataManagerMock.addMemberToProject).toHaveBeenCalledWith(projectId, fakeUser, 'DEVELOPER');
  });

  it('sollte getProjectUsersSignal ein reaktives Signal mit reinen UserModels liefern', () => {
    const user1 = createTestUser({ id: '1', username: 'u1', firstName: 'A', lastName: 'B', projectIds: [] });
    const user2 = createTestUser({ id: '2', username: 'u2', firstName: 'C', lastName: 'D', projectIds: [] });
    
    currentProjectMembersSignalMock.set([
      new ProjectMember(user1, 'DEVELOPER'),
      new ProjectMember(user2, 'DEVELOPER')
    ]);

    const usersSignal = service.getProjectUsersSignal('any-project');
    const userList = usersSignal();

    expect(userList.length).toBe(2);
    expect(userList[0]).toBe(user1);
    expect(userList[1]).toBe(user2);
  });

  it('sollte updateCoffeeAccount transparent an den DataManager weiterreichen', () => {
    service.updateCoffeeAccount('user-1', 15.50, 'DEVELOPER', '☕');

    expect(dataManagerMock.updateCoffeeAccount).toHaveBeenCalledWith('user-1', 15.50, 'DEVELOPER', '☕');
  });
});