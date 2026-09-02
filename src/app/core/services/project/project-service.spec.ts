import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectService } from './project-service';
import { ProjectDataManagerService } from './project-data-manager-service';
import { UserService } from '../user/user-service';
import { NoteService } from '../note/note-service';
import { NotificationService } from '../notification/notification-service';
import { ProjectDraftService } from './project-draft-service';
import { signal, WritableSignal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { Project } from '../../models/project';
import { TodoViewModel } from '../../viewmodel/todo-view-model';
import { UnifiedSuggestion } from '../../models/unified-suggestion';
import { IUserInit, UserModel } from '../../models/user-model';
import { Milestone } from '../../models/milestone';

describe('ProjectService (Vitest - Strictly Typed)', () => {
  let service: ProjectService;
  
  // 🏭 Helper-Factory für UserModel
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

  // Typsichere Mocks
  let dataManagerMock: Partial<ProjectDataManagerService>;
  let userServiceMock: Partial<UserService>;
  let noteServiceMock: Partial<NoteService>;
  let notificationServiceMock: Partial<NotificationService>;
  let draftServiceMock: Partial<ProjectDraftService>;

  // Reaktive Signals für Mocks
  let currentUserSignal: WritableSignal<UserModel | null>;
  let currentDraftSignal: WritableSignal<Project | null>;

  beforeEach(() => {
    currentUserSignal = signal<UserModel | null>(null);
    currentDraftSignal = signal<Project | null>(null);

    dataManagerMock = {
      getProjects: vi.fn().mockReturnValue(of([])),
      updateProject: vi.fn(),
      createProject: vi.fn(),
      deleteProject: vi.fn(),
      trackMilestoneSelection: vi.fn().mockReturnValue(of(null)),
      trackMilestoneDegradation: vi.fn().mockReturnValue(of(null)),
      trackMilestoneIgnorance: vi.fn().mockReturnValue(of(null)),
      getMilestoneSuggestions: vi.fn().mockReturnValue(of({ recommended: [], degraded: [] })),
      getDashboardStatistics: vi.fn()
    };
    
    userServiceMock = {
      currentUser: currentUserSignal,
      getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    noteServiceMock = {
      updateNoteStatus: vi.fn()
    };

    notificationServiceMock = {
      showNotification: vi.fn()
    };

    draftServiceMock = {
      currentDraft: currentDraftSignal
    };

    TestBed.configureTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectDataManagerService, useValue: dataManagerMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: NoteService, useValue: noteServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: ProjectDraftService, useValue: draftServiceMock }
      ]
    });

    service = TestBed.inject(ProjectService);
  });

  afterEach(() => {
    currentUserSignal.set(null);
    currentDraftSignal.set(null);
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. REINE LOGIK-TESTS
  // ==========================================
  describe('Berechnungslogik', () => {
    
    it('sollte den Meilenstein-Status korrekt als "Offen" berechnen, wenn keine Todos existieren', () => {
      expect(service.calculateMilestoneStatus([])).toBe('Offen');
    });

    it('sollte den Status als "In Arbeit" berechnen, wenn mindestens ein Todo erledigt ist', () => {
      const todos = [
        { todo: { done: true, effort: 5 } },
        { todo: { done: false, effort: 3 } }
      ] as TodoViewModel[];
      
      expect(service.calculateMilestoneStatus(todos)).toBe('In Arbeit');
    });

    it('sollte den Status als "Erledigt" berechnen, wenn alle Todos erledigt sind', () => {
      const todos = [
        { todo: { done: true, effort: 5 } },
        { todo: { done: true, effort: 3 } }
      ] as TodoViewModel[];
      
      expect(service.calculateMilestoneStatus(todos)).toBe('Erledigt');
    });

    it('sollte den Fortschritt (Progress) in Prozent korrekt runden', () => {
      const todos = [
        { todo: { done: true, effort: 2 } }, // 2 Punkte erledigt
        { todo: { done: false, effort: 4 } } // von insgesamt 6 Punkten (~33%)
      ] as TodoViewModel[];

      expect(service.calculateMilestoneProgress(todos)).toBe(33);
    });
  });

  // ==========================================
  // 2. SIGNALS & KI-FILTERUNG
  // ==========================================
  describe('Signals & KI-Filterung', () => {
it('sollte Vorschläge herausfiltern, die bereits im Entwurf (Draft) existieren', () => {
      // 1. Setup: Draft mit einem vollständigen Project-Objekt erstellen
currentDraftSignal.set(new Project({
        id: 'p1',
        title: 'Mein Projekt',
        area: 'Tech',
        ideaId: 'idea-123',
        userId: 'user-123',
        departmentId: 'dept-123',
        milestones: [
          new Milestone({
            title: 'Konzept',
            duration: 5
          })
        ]
      }));
      
      const testUser = createTestUser({ id: 'user-123' });
      currentUserSignal.set(testUser);
      
      const mockSuggestions = {
        recommended: [
          { title: 'Konzept', source: 'KI', isRecommended: true, words: [] },
          { title: 'Design', source: 'KI', isRecommended: true, words: [] }
        ] as UnifiedSuggestion[],
        degraded: [] as UnifiedSuggestion[]
      };

      vi.mocked(dataManagerMock.getMilestoneSuggestions!).mockReturnValue(of(mockSuggestions));

      // 2. Aktion: Vorschläge laden
      service.loadMilestoneSuggestions('Mein Projekt', 'Tech');

      // 3. Reaktivität erzwingen
      TestBed.flushEffects();

      // 4. Auswertung
      const filtered = service.suggestions();
      
      expect(filtered).not.toBeNull();
      expect(filtered?.recommended).toHaveLength(1);
      expect(filtered?.recommended[0].title).toBe('Design');
    });
  });

  // ==========================================
  // 3. ASYNCHRONER KRAM & FEHLERHANDLING
  // ==========================================
  describe('Projekt-Aktionen & Analytics', () => {

    it('sollte beim Speichern eines Projekts die Notiz via NoteService sperren/aktualisieren', () => {
      const mockProject = new Project({ id: 'p2', title: 'Vitest App', ideaId: 'note-99', userId: 'user-123', area: 'Tech', departmentId: "dept" });
      vi.mocked(userServiceMock.getCurrentUserId!).mockReturnValue('user-123');
      vi.mocked(dataManagerMock.createProject!).mockReturnValue(of(mockProject));

      service.saveCalculatedProject(mockProject).subscribe(() => {
        expect(noteServiceMock.updateNoteStatus).toHaveBeenCalledWith('note-99', true);
      });
    });

    it('sollte bei einer Offline-Fehlermeldung die passende Benachrichtigung anzeigen', () => {
      vi.mocked(userServiceMock.getCurrentUserId!).mockReturnValue('user-123');
      vi.mocked(dataManagerMock.getDashboardStatistics!).mockReturnValue(
        throwError(() => new Error('OFFLINE_MODE'))
      );

      service.loadDashboardStatistics();

      expect(notificationServiceMock.showNotification).toHaveBeenCalledWith(
        expect.stringContaining('Offline-Modus'),
        'info'
      );
    });
  });
});