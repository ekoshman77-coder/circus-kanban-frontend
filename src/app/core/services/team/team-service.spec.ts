import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal, computed } from '@angular/core';
import { TeamService } from './team-service';
import { TeamDataManager } from './team-data-manager';
import { UserService } from '../user/user-service';
import { PermissionService, UIActionIntent } from '../permissions/permission-service';
import { ProjectService } from '../project/project-service';
import { IUserInit, UserModel } from '../../models/user-model';
import { ProjectMember } from '../../models/project-member';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('TeamService (Vitest - Strict Typing)', () => {
  let service: TeamService;

  const createTestUser = (overrides: Partial< IUserInit > = {}): UserModel => {
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
  let globalMembersSignalMock: WritableSignal< ProjectMember[] >;
  let currentProjectMembersSignalMock: WritableSignal< ProjectMember[] >;
  let projectsListSignalMock: WritableSignal< any[] >;
  let currentUserSignalMock: WritableSignal< UserModel | null >;

  let dataManagerMock: Partial< TeamDataManager >;
  let userServiceMock: Partial< UserService >;
  let permissionServiceMock: Partial< PermissionService >;
  let projectServiceMock: Partial< ProjectService >;

  beforeEach(() => {
    globalMembersSignalMock = signal< ProjectMember[] >([]);
    currentProjectMembersSignalMock = signal< ProjectMember[] >([]);
    projectsListSignalMock = signal< any[] >([]);
    currentUserSignalMock = signal< UserModel | null >(createTestUser());

    // 🎯 Angepasster DataManager-Mock ohne veraltete Methoden
    dataManagerMock = {
      globalMembersSignal: globalMembersSignalMock,
      updateGlobalMember: vi.fn(),
      updateCoffeeAccount: vi.fn(),
      deleteGlobalMember: vi.fn(),
      createMember: vi.fn()
    };

    // 🎯 Korrigierter UserService-Mock mit echtem Signal für currentUser
    userServiceMock = {
      getCurrentUserId: vi.fn().mockReturnValue('user-active'),
      currentUser: computed(() => currentUserSignalMock())
    };

    permissionServiceMock = {
      canUserPerformAction: vi.fn((action: UIActionIntent, context: any) => {
        if (context.isOwner) return true;
        if (context.contextRole === 'DEVELOPER' && action === 'TODO_CREATE') return true;
        if (context.contextRole === 'DEVELOPER' && action === 'PROJECT_DELETE') return false;
        return false;
      })
    };

    projectServiceMock = {
      currentProjectMembersSignal: currentProjectMembersSignalMock,
      projectsList: projectsListSignalMock,
      setActiveProjectId: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        TeamService,
        { provide: TeamDataManager, useValue: dataManagerMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: PermissionService, useValue: permissionServiceMock },
        { provide: ProjectService, useValue: projectServiceMock }
      ]
    });

    service = TestBed.inject(TeamService);
    
    globalMembersSignalMock.set([]);
    currentProjectMembersSignalMock.set([]);
    projectsListSignalMock.set([]);
    currentUserSignalMock.set(createTestUser());
  });

  it('sollte bei setCurrentProject die ID an den ProjectService weiterleiten', () => {
    const projectId = 'project-123';

    service.setCurrentProject(projectId);

    expect(projectServiceMock.setActiveProjectId).toHaveBeenCalledWith(projectId);
  }); 

  describe('Rechteprüfung (hasPermission)', () => {
    it('sollte false zurückgeben, wenn das Projekt nicht gefunden wird', () => {
      expect(service.hasPermission('project-123', 'PROJECT_EDIT' as UIActionIntent)).toBe(false);
    });

    it('sollte true zurückgeben, wenn ein OWNER das Projekt löschen möchte', () => {
      projectsListSignalMock.set([{ id: 'project-123', userId: 'user-active' }]);
      
      const activeUser = createTestUser({ id: 'user-active', username: 'elena', firstName: 'E', lastName: 'L', projectIds: ['project-123'] });
      currentProjectMembersSignalMock.set([
        new ProjectMember(activeUser, 'OWNER')
      ]);

      expect(service.hasPermission('project-123', 'PROJECT_DELETE' as UIActionIntent)).toBe(true);
      expect(service.hasPermission('project-123', 'MILESTONE_CREATE' as UIActionIntent)).toBe(true);
    });

    it('sollte false zurückgeben, wenn ein DEVELOPER versucht ein Projekt zu löschen', () => {
      projectsListSignalMock.set([{ id: 'project-123', userId: 'other-owner' }]);

      const activeUser = createTestUser({ id: 'user-active', username: 'designer-guy', firstName: 'D', lastName: 'G', projectIds: ['project-123'] });
      currentProjectMembersSignalMock.set([
        new ProjectMember(activeUser, 'DEVELOPER')
      ]);

      expect(service.hasPermission('project-123', 'PROJECT_DELETE' as UIActionIntent)).toBe(false);
      expect(service.hasPermission('project-123', 'TODO_CREATE' as UIActionIntent)).toBe(true);
    });
  });

  it('sollte updateCoffeeAccount transparent an den DataManager weiterreichen', () => {
    service.updateCoffeeAccount('user-1', 15.50, 'DEVELOPER', '☕');

    expect(dataManagerMock.updateCoffeeAccount).toHaveBeenCalledWith('user-1', 15.50, 'DEVELOPER', '☕');
  });
});