import { TestBed } from '@angular/core/testing';
import { ProjectDataManagerService } from './project-data-manager-service';
import { ProjectRepository } from '../../repositories/project-repository';
import { ConnectionService } from '../connection/connection-service';
import { AiRepository } from '../../repositories/ai-repository';
import { Project } from '../../models/project';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { signal, WritableSignal } from '@angular/core';

describe('ProjectDataManagerService (Vitest - Strictly Typed)', () => {
  let service: ProjectDataManagerService;

  // Typsichere Mocks
  let mockProjectRepo: Partial<ProjectRepository>;
  let mockConnectionService: Partial<ConnectionService>;
  let mockAiRepo: Partial<AiRepository>;

  // LocalStorage Mock-Store
  let store: Record<string, string> = {};
  
  let testProject: Project;

  let isOfflineSignal: WritableSignal<boolean>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; }
    });

    isOfflineSignal = signal<boolean>(false);

    mockConnectionService = {
      isOffline: isOfflineSignal
    };
    
    mockProjectRepo = {
      getProjectsByUserId: vi.fn().mockReturnValue(of([])),
      createProject: vi.fn().mockImplementation((p) => of(p)),
      updateProject: vi.fn().mockImplementation((id, p) => of({ id, ...p })),
      deleteProject: vi.fn().mockReturnValue(of(undefined)),
      syncLocalProjects: vi.fn().mockReturnValue(of([])),
      getDashboardStatistics: vi.fn().mockReturnValue(of({ totalProjects: 10, activeProjects: 5, completedProjects: 5 }))
    };

    mockAiRepo = {
      getMilestoneSuggestions: vi.fn().mockReturnValue(of({ recommended: [], degraded: [] })),
      trackMilestoneSelection: vi.fn().mockReturnValue(of(undefined)),
      trackMilestoneDegradation: vi.fn().mockReturnValue(of(undefined)),
      trackMilestonesIgnore: vi.fn().mockReturnValue(of(undefined))
    };

    TestBed.configureTestingModule({
      providers: [
        ProjectDataManagerService,
        { provide: ProjectRepository, useValue: mockProjectRepo },
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: AiRepository, useValue: mockAiRepo }
      ]
    });

    service = TestBed.inject(ProjectDataManagerService);

    testProject = new Project({
      id: 'proj-123',
      userId: 'user-456',
      ideaId: 'idea-999',
      title: 'Standard Test Projekt',
      area: 'Software',
      departmentId: 'dept-123',
      content: 'Beschreibung',
      status: 'Active',
      milestones: [],
      teamMembers: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getProjects (Projekte laden)', () => {
    it('sollte online Daten vom Server laden und im global_pool cachen', () => {
      const backendProj = { 
        id: 'live-1', 
        title: 'Online Projekt', 
        userId: 'user-123', 
        ideaId: 'idea-1', 
        area: 'Tech', 
        departmentId: 'dept-1', 
        milestones: [] 
      };
      vi.mocked(mockProjectRepo.getProjectsByUserId!).mockReturnValueOnce(of([backendProj as any]));

      service.getProjects('user-123').subscribe((projects: Project[]) => {
        expect(projects.length).toBe(1);
        expect(projects[0].title).toBe('Online Projekt');
        
        const cached = JSON.parse(localStorage.getItem('local_projects_global_pool')!);
        expect(cached[0].title).toBe('Online Projekt');
      });
    });

it('sollte offline direkt auf das LocalStorage-Backup (global_pool) zugreifen', () => {
      // 🟢 Richtig: Signal auf true setzen
      isOfflineSignal.set(true);
      
      testProject.title = 'Offline UI Projekt';
      localStorage.setItem('local_projects_global_pool', JSON.stringify([testProject]));

      service.getProjects('user-123').subscribe((projects: Project[]) => {
        expect(projects.length).toBe(1);
        expect(projects[0].title).toBe('Offline UI Projekt');
        expect(mockProjectRepo.getProjectsByUserId).not.toHaveBeenCalled();
      });
    });
  });

  describe('Doppel-Buchführung im Offline-Modus', () => {
    it('sollte beim Erstellen offline das Projekt im global_pool UND in der pending_sync Queue sichern', () => {
      isOfflineSignal.set(true);
      
      testProject.id = 'OFFLINE_123';
      testProject.title = 'Neues Offline Projekt';

      service.createProject(testProject, []).subscribe(res => {
        expect(res.title).toBe('Neues Offline Projekt');

        const uiCache = JSON.parse(localStorage.getItem('local_projects_global_pool')!);
        expect(uiCache.length).toBe(1);
        expect(uiCache[0].title).toBe('Neues Offline Projekt');

        const syncQueue = JSON.parse(localStorage.getItem('local_projects_pending_sync')!);
        expect(syncQueue.length).toBe(1);
        expect(syncQueue[0].id).toBe('OFFLINE_123');
      });
    });

    it('sollte beim Ändern offline die Änderung im global_pool UND in der pending_sync Queue nachführen', () => {
     isOfflineSignal.set(true);
      
      testProject.id = 'proj-555';
      testProject.title = 'Projekt Version A';
      localStorage.setItem('local_projects_pending_sync', JSON.stringify([testProject]));

      const geaendertesProj = new Project({
        id: testProject.id,
        userId: testProject.userId,
        ideaId: testProject.ideaId,
        area: testProject.area,
        departmentId: testProject.departmentId,
        title: 'Projekt Version B'
      });

      service.updateProject(geaendertesProj, [testProject]).subscribe(() => {
        const uiCache = JSON.parse(localStorage.getItem('local_projects_global_pool')!);
        expect(uiCache[0].title).toBe('Projekt Version B');

        const syncQueue = JSON.parse(localStorage.getItem('local_projects_pending_sync')!);
        expect(syncQueue[0].title).toBe('Projekt Version B');
      });
    });

    it('sollte beim Löschen offline das Projekt aus beiden Töpfen entfernen', () => {
      testProject.id = 'proj-delete';
      
      localStorage.setItem('local_projects_global_pool', JSON.stringify([testProject]));
      localStorage.setItem('local_projects_pending_sync', JSON.stringify([testProject]));

      service.deleteProject('proj-delete', [testProject]).subscribe(() => {
        const uiCache = JSON.parse(localStorage.getItem('local_projects_global_pool')!);
        expect(uiCache.length).toBe(0);

        const syncQueue = JSON.parse(localStorage.getItem('local_projects_pending_sync')!);
        expect(syncQueue.length).toBe(0);
      });
    });
  });

  describe('synchronizeData (Wieder online gehen)', () => {
    it('sollte die pending_sync Queue zum Server senden und danach vollständig leeren', () => {
      testProject.id = 'tmp_offline_1';
      testProject.title = 'Offline Entwurf';
      localStorage.setItem('local_projects_pending_sync', JSON.stringify([testProject]));

      const serverResponse = [{ 
        id: 'server-id-1', 
        title: 'Offline Entwurf (Serverversion)', 
        userId: 'user-777', 
        ideaId: 'idea-1', 
        area: 'Tech', 
        departmentId: 'dept-1' 
      }];
      vi.mocked(mockProjectRepo.syncLocalProjects!).mockReturnValueOnce(of(serverResponse as any));

      service.synchronizeData('user-777').subscribe((res: Project[]) => {
        expect(res.length).toBe(1);
        expect(res[0].id).toBe('server-id-1');

        const syncQueue = JSON.parse(localStorage.getItem('local_projects_pending_sync')!);
        expect(syncQueue.length).toBe(0);
      });
    });
  });

  describe('Hybrid-Weiche (getMilestoneSuggestions)', () => {
    it('sollte online das AiRepository befragen', () => {
      const mockSuggestion = { title: 'KI-Tipp', score: 99, words: [] };
      vi.mocked(mockAiRepo.getMilestoneSuggestions!).mockReturnValueOnce(of({
        recommended: [mockSuggestion],
        degraded: []
      }));

      service.getMilestoneSuggestions('App', 'Software', 'user-1').subscribe(res => {
        expect(res.recommended.length).toBe(1);
        expect(res.recommended[0].title).toBe('KI-Tipp');
        expect(res.recommended[0].source).toBe('KI');
      });
    });

    it('sollte offline auf statische Templates ausweichen', () => {
      isOfflineSignal.set(true);

      service.getMilestoneSuggestions('App', 'Software', 'user-1').subscribe(res => {
        expect(res.recommended.length).toBeGreaterThan(0);
        expect(res.recommended[0].source).toBe('TEMPLATE');
      });
    });
  });
});