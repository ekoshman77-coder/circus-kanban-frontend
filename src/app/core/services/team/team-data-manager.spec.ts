import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TeamDataManager } from './team-data-manager';
import { TeamRepository } from '../../repositories/team-repository';
import { UserRepository } from '../../repositories/user-repository';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';
import { NotificationService } from '../notification/notification-service';
import { UserModel } from '../../models/user-model';
import { ProjectMember } from '../../models/project-member';
import { of } from 'rxjs';
import { setupLocalStorageMock } from '../../shared/test-utils/local-storage-mock';


describe('TeamDataManager (Vitest)', () => {
  let manager: TeamDataManager;
  
  // Mocks für die Repositories und Services
  let teamRepoMock: any;
  let userRepoMock: any;
  let connectionServiceMock: any;
  let userServiceMock: any;
  let notificationServiceMock: any;

  // Reaktives Signal für den Online-Status im Mock steuerbar machen
  let isOnlineSignal = signal<boolean>(false);

  beforeEach(() => { 

    setupLocalStorageMock();
    // 1. Spione (Mocks) aufbauen
    teamRepoMock = {
      getMembersForProject$: vi.fn().mockReturnValue(of([])),
      getAllGlobalUsers$: vi.fn().mockReturnValue(of([])),
      assignToProject$: vi.fn().mockReturnValue(of(null)),
      deleteFromProject$: vi.fn().mockReturnValue(of(null)),
      updateCoffeeAccount$: vi.fn().mockReturnValue(of(null))
    };

    userRepoMock = {
      updateProfile$: vi.fn().mockReturnValue(of(null)),
      deleteGlobalUser$: vi.fn().mockReturnValue(of(null)),
      register: vi.fn().mockReturnValue(of({ id: 'new-id', username: 'newuser' }))
    };

    connectionServiceMock = {
      isOnline: vi.fn().mockImplementation(() => isOnlineSignal())
    };

    userServiceMock = {
      getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    notificationServiceMock = {
      showNotification: vi.fn()
    };

    // LocalStorage vor jedem Test leeren, damit sich Tests nicht gegenseitig stören
    localStorage.clear();

    // 2. TestBed konfigurieren
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

    // Wichtig: Wir steuern den Start-Zustand standardmäßig auf OFFLINE
    isOnlineSignal.set(false);
  });

  it('sollte beim Erstellen globale Mitglieder aus dem Cache laden', () => {
    // Vorbereitung: Wir legen Fake-Daten in den LocalStorage
    const fakeCachedMembers = [
      {
        user: { id: 'u1', firstName: 'Elena', username: 'elena_dev', projectIds: [] },
        projectRole: 'OWNER'
      }
    ];
    localStorage.setItem('offline_global_members', JSON.stringify(fakeCachedMembers));

    // Ausführung: Erst JETZT instanziieren wir den Service über TestBed
    manager = TestBed.inject(TeamDataManager);

    // Auswertung
    const globalMembers = manager.globalMembersSignal();
    expect(globalMembers.length).toBe(1);
    expect(globalMembers[0].user.firstName).toBe('Elena');
    expect(globalMembers[0].projectRole).toBe('OWNER');
  });

  it('sollte im Offline-Modus Daten aus dem Projekt-Cache laden, falls vorhanden', () => {
    manager = TestBed.inject(TeamDataManager);
    const projectId = 'project-abc';
    const cacheKey = `offline_project_members_${projectId}`;
    
    const fakeProjectMembers = [
      {
        user: { id: 'u2', firstName: 'Max', username: 'max_design', projectIds: ['project-abc'] },
        projectRole: 'DESIGNER'
      }
    ];
    localStorage.setItem(cacheKey, JSON.stringify(fakeProjectMembers));

    // Ausführung
    manager.loadProjectMembers(projectId);

    // Auswertung
    expect(manager.isProjectOfflineAvailable()).toBe(true);
    expect(manager.currentProjectMembersSignal().length).toBe(1);
    expect(manager.currentProjectMembersSignal()[0].user.firstName).toBe('Max');
    // Sicherstellen, dass das Repository NICHT gerufen wurde, weil wir ja offline sind!
    expect(teamRepoMock.getMembersForProject$).not.toHaveBeenCalled();
  });

  it('sollte das Flag isProjectOfflineAvailable auf false setzen, wenn Projekt offline fehlt', () => {
    manager = TestBed.inject(TeamDataManager);
    const projectId = 'unbekanntes-projekt';

    // Ausführung (Cache ist leer!)
    manager.loadProjectMembers(projectId);

    // Auswertung
    expect(manager.isProjectOfflineAvailable()).toBe(false);
    expect(manager.currentProjectMembersSignal().length).toBe(0);
  });

  it('sollte bei addMemberToProject sofort die Optimistic UI bedienen (Signal und Cache)', () => {
    manager = TestBed.inject(TeamDataManager);
    const projectId = 'proj-1';
    const newUser = new UserModel({ id: 'u3', username: 'newbie', firstName: 'Tom', lastName: 'Tester', projectIds: [] });

    // Ausführung
    manager.addMemberToProject(projectId, newUser, 'DEVELOPER');

    // Auswertung: Signal muss sofort gefüllt sein
    const members = manager.currentProjectMembersSignal();
    expect(members.length).toBe(1);
    expect(members[0].user.firstName).toBe('Tom');
    expect(members[0].projectRole).toBe('DEVELOPER');

    // Auswertung: Auch im LocalStorage muss es sofort stehen
    const cached = localStorage.getItem(`offline_project_members_${projectId}`);
    expect(cached).toBeTruthy();
    expect(JSON.parse(cached!).length).toBe(1);
  });
});