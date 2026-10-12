import { TestBed } from '@angular/core/testing';
import { ProjectDataManagerService } from './project-data-manager-service';
import { ProjectRepository } from '../../repositories/project-repository';
import { ConnectionService } from '../connection/connection-service';
import { AiRepository } from '../../repositories/ai-repository';
import { TeamRepository } from '../../repositories/team-repository';
import { CentralQueueService } from '../central-queue/central-queue-service';
import { Project } from '../../models/project';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { signal, WritableSignal } from '@angular/core';
import { QueueHandlerName } from '../../enums/queue-handler-name';

describe('ProjectDataManagerService (Vitest - Strictly Typed)', () => {
  let service: ProjectDataManagerService;

  // Typsichere Mocks
  let mockProjectRepo: Partial< ProjectRepository >;
  let mockTeamRepo: Partial< TeamRepository >;
  let mockConnectionService: Partial< ConnectionService >;
  let mockAiRepo: Partial< AiRepository >;
  let mockQueueService: Partial< CentralQueueService >;

  // LocalStorage Mock-Store
  let store: Record< string, string > = {};
  
  let testProject: Project;
  let isOfflineSignal: WritableSignal< boolean >;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; }
    });

    isOfflineSignal = signal< boolean >(false);

    mockConnectionService = {
      isOffline: isOfflineSignal,
      isOnline: signal< boolean >(true)
    };
    
    mockProjectRepo = {
      getAllProjects: vi.fn().mockReturnValue(of([])),
      createProject: vi.fn().mockImplementation((p) => of(p)),
      updateProject: vi.fn().mockImplementation((p) => of(p)),
      deleteProject: vi.fn().mockReturnValue(of(undefined)),
      getDashboardStatistics: vi.fn().mockReturnValue(of({ totalProjects: 10, activeProjects: 5, completedProjects: 5 }))
    };

    mockTeamRepo = {
      assignToProject$: vi.fn().mockReturnValue(of(null)),
      deleteFromProject$: vi.fn().mockReturnValue(of(null))
    };

    mockAiRepo = {
      getMilestoneSuggestions: vi.fn().mockReturnValue(of({ recommended: [], degraded: [] })),
      trackMilestoneSelection: vi.fn().mockReturnValue(of(undefined)),
      trackMilestoneDegradation: vi.fn().mockReturnValue(of(undefined)),
      trackMilestonesIgnore: vi.fn().mockReturnValue(of(undefined))
    };

    mockQueueService = {
      enqueue: vi.fn(),
      registerService: vi.fn(),
      updateEntityIdInQueue: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        ProjectDataManagerService,
        { provide: ProjectRepository, useValue: mockProjectRepo },
        { provide: TeamRepository, useValue: mockTeamRepo },
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: AiRepository, useValue: mockAiRepo },
        { provide: CentralQueueService, useValue: mockQueueService }
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

  describe('Projekterstellung und Enqueueing', () => {
    it('sollte beim Erstellen das Projekt lokal anwenden und in die Queue reihen', () => {
      service.createProject(testProject);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.PROJECT,
        'CREATE',
        expect.objectContaining({
          id: testProject.id,
          project: testProject
        })
      );
    });

    it('sollte beim Aktualisieren die Änderung lokal anwenden und in die Queue reihen', () => {
      const geaendertesProj = new Project({
        ...testProject,
        title: 'Neuer Titel'
      });

      service.updateProject(geaendertesProj);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.PROJECT,
        'UPDATE',
        expect.objectContaining({
          id: geaendertesProj.id,
          project: geaendertesProj
        })
      );
    });

    it('sollte beim Löschen das Projekt lokal entfernen und Lösch-Auftrag enqueuen', () => {
      service.deleteProject('proj-123');

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.PROJECT,
        'DELETE',
        expect.objectContaining({
          id: 'proj-123'
        })
      );
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