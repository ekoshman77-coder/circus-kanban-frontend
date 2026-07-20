import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TeamService } from './team-service';
import { TeamDataManager } from './team-data-manager';
import { UserService } from '../user/user-service';
import { UserModel } from '../../models/user-model';
import { ProjectMember } from '../../models/project-member';

describe('TeamService (Vitest)', () => {
  let service: TeamService;
  
  // Mocks für die injizierten Services
  let dataManagerMock: any;
  let userServiceMock: any;

  // Wir simulieren die Signals aus dem DataManager
  let globalMembersSignalMock = signal<ProjectMember[]>([]);
  let currentProjectMembersSignalMock = signal<ProjectMember[]>([]);

  beforeEach(() => {
    // Spione für den DataManager aufbauen
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

    // Spion für den UserService
    userServiceMock = {
      getCurrentUserId: vi.fn().mockReturnValue('user-active')
    };

    TestBed.configureTestingModule({
      providers: [
        TeamService,
        { provide: TeamDataManager, useValue: dataManagerMock },
        { provide: UserService, useValue: userServiceMock }
      ]
    });

    service = TestBed.inject(TeamService);
    
    // Vor jedem Test Signals zurücksetzen
    globalMembersSignalMock.set([]);
    currentProjectMembersSignalMock.set([]);
  });

  it('sollte bei setCurrentProject die ID setzen und den DataManager zum Laden triggern', () => {
    const projectId = 'project-123';

    // Ausführung
    service.setCurrentProject(projectId);

    // Auswertung
    expect(service.currentProjectId()).toBe(projectId);
    expect(dataManagerMock.loadProjectMembers).toHaveBeenCalledWith(projectId);
  }); 

  describe('Rechteprüfung (hasPermission)', () => {
    it('sollte false zurückgeben, wenn keine Projektmitglieder geladen sind', () => {
      expect(service.hasPermission('project-123', 'PROJECT_EDIT')).toBe(false);
    });

    it('sollte true zurückgeben, wenn ein OWNER das Projekt löschen möchte', () => {
      // Vorbereitung: Wir setzen den aktiven User als OWNER ins Projekt-Signal
      const activeUser = new UserModel({ id: 'user-active', username: 'elena', firstName: 'E', lastName: 'L', projectIds: ['project-123'] });
      currentProjectMembersSignalMock.set([
        new ProjectMember(activeUser, 'OWNER')
      ]);

      // Ausführung & Auswertung
      expect(service.hasPermission('project-123', 'PROJECT_DELETE')).toBe(true);
      expect(service.hasPermission('project-123', 'MILESTONE_CREATE')).toBe(true);
    });

    it('sollte false zurückgeben, wenn ein DESIGNER versucht ein Projekt zu löschen', () => {
      // Vorbereitung: Wir setzen den aktiven User als DESIGNER ins Projekt-Signal
      const activeUser = new UserModel({ id: 'user-active', username: 'designer-guy', firstName: 'D', lastName: 'G', projectIds: ['project-123'] });
      currentProjectMembersSignalMock.set([
        new ProjectMember(activeUser, 'DESIGNER')
      ]);

      // Ausführung & Auswertung
      expect(service.hasPermission('project-123', 'PROJECT_DELETE')).toBe(false); // Verboten!
      expect(service.hasPermission('project-123', 'TODO_CREATE')).toBe(true);     // Erlaubt!
    });
  });

  it('sollte addMemberToProject transparent an den DataManager weiterreichen', () => {
    const projectId = 'proj-99';
    const fakeUser = new UserModel({ id: 'u-9', username: 'test', firstName: 'A', lastName: 'B', projectIds: [] });

    // Ausführung
    service.addMemberToProject(projectId, fakeUser, 'DEVELOPER');

    // Auswertung
    expect(dataManagerMock.addMemberToProject).toHaveBeenCalledWith(projectId, fakeUser, 'DEVELOPER');
  });

  it('sollte getProjectUsersSignal ein reaktives Signal mit reinen UserModels liefern', () => {
    // Vorbereitung: Wir befüllen das Members-Signal
    const user1 = new UserModel({ id: '1', username: 'u1', firstName: 'A', lastName: 'B', projectIds: [] });
    const user2 = new UserModel({ id: '2', username: 'u2', firstName: 'C', lastName: 'D', projectIds: [] });
    
    currentProjectMembersSignalMock.set([
      new ProjectMember(user1, 'DEVELOPER'),
      new ProjectMember(user2, 'VIEWER')
    ]);

    // Ausführung
    const usersSignal = service.getProjectUsersSignal('any-project');
    const userList = usersSignal();

    // Auswertung
    expect(userList.length).toBe(2);
    expect(userList[0]).toBe(user1);
    expect(userList[1]).toBe(user2);
  });

  it('sollte updateCoffeeAccount transparent an den DataManager weiterreichen', () => {
    // Ausführung
    service.updateCoffeeAccount('user-1', 15.50, 'DEVELOPER', '☕');

    // Auswertung
    expect(dataManagerMock.updateCoffeeAccount).toHaveBeenCalledWith('user-1', 15.50, 'DEVELOPER', '☕');
  });
});