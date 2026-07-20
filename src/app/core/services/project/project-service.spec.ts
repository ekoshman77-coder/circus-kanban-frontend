import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectService } from './project-service';
import { ProjectDataManagerService } from './project-data-manager-service';
import { UserService } from '../user/user-service';
import { NoteService } from '../note/note-service';
import { NotificationService } from '../notification/notification-service';
import { ProjectDraftService } from './project-draft-service';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { Project } from '../../models/project';
import { TodoViewModel } from '../../viewmodel/todo-view-model';
import { UnifiedSuggestion } from '../../models/unified-suggestion';


describe('ProjectService (Vitest)', () => {
  let service: ProjectService;
  
  // Mock-Objekte deklarieren
  let dataManagerMock: any;
  let userServiceMock: any;
  let noteServiceMock: any;
  let notificationServiceMock: any;
  let draftServiceMock: any;

  // Reaktivität über echte Angular Signals simulieren
  const currentUserSignal = signal<any>(null);
  const currentDraftSignal = signal<any>(null);

  beforeEach(() => {
    // Vitest Mocks erstellen
    dataManagerMock = {
      getProjects: vi.fn().mockReturnValue(of([])),
      updateProject: vi.fn(),
      createProject: vi.fn(),
      deleteProject: vi.fn(),
      trackMilestoneSelection: vi.fn(),
      trackMilestoneDegradation: vi.fn(),
      trackMilestoneIgnorance: vi.fn(),
      getMilestoneSuggestions: vi.fn(),
      getDashboardStatistics: vi.fn()
    };
    
    userServiceMock = {
      currentUser: vi.fn().mockReturnValue(currentUserSignal),
      getCurrentUserId: vi.fn()
    };

    noteServiceMock = {
      updateNoteStatus: vi.fn()
    };

    notificationServiceMock = {
      showNotification: vi.fn()
    };

    draftServiceMock = {
      get currentDraft() {
       return currentDraftSignal;
      }
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
    // Signale nach jedem Test zurücksetzen
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
it('sollte Vorschläge herausfiltern, die bereits im Entwurf (Draft) existieren', () => {
  // 1. Setup: Draft mit bereits existierendem Meilenstein vorbereiten
  currentDraftSignal.set({
    milestones: [{ title: 'Konzept' }]
  } as any);

  userServiceMock.getCurrentUserId.mockReturnValue('user-123');
  currentUserSignal.set({ id: 'user-123' }); // Damit der Constructor-Effect happy ist
  
  const mockSuggestions = {
    recommended: [
      { title: 'Konzept', source: 'KI', isRecommended: true, words: [] },
      { title: 'Design', source: 'KI', isRecommended: true, words: [] }
    ] as UnifiedSuggestion[],
    degraded: [] as UnifiedSuggestion[]
  };

  dataManagerMock.getMilestoneSuggestions.mockReturnValue(of(mockSuggestions));

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

  // ==========================================
  // 3. ASYNCHRONER KRAM & FEHLERHANDLING
  // ==========================================
  describe('Projekt-Aktionen & Analytics', () => {

    it('sollte beim Speichern eines Projekts die Notiz via NoteService sperren/aktualisieren', () => {
      const mockProject = new Project({ id: 'p2', title: 'Vitest App', ideaId: 'note-99', userId: 'user-123', area: 'Tech' });
      userServiceMock.getCurrentUserId.mockReturnValue('user-123');
      dataManagerMock.createProject.mockReturnValue(of(mockProject));

      service.saveCalculatedProject(mockProject).subscribe(() => {
        expect(noteServiceMock.updateNoteStatus).toHaveBeenCalledWith('note-99', true);
      });
    });

    it('sollte bei einer Offline-Fehlermeldung die passende Benachrichtigung anzeigen', () => {
      userServiceMock.getCurrentUserId.mockReturnValue('user-123');
      dataManagerMock.getDashboardStatistics.mockReturnValue(
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