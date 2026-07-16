import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamBoardComponent } from './team-board-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { TeamService } from '../../../core/services/team/team-service';
import { ProjectService } from '../../../core/services/project/project-service';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TodoQueryService } from '../../../core/services/todo/todo-query-service';
import { UserService } from '../../../core/services/user/user-service';
import { signal } from '@angular/core';
import { Todo } from '../../../core/models/todo';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TeamBoardComponent (Vitest Edition)', () => {
  let component: TeamBoardComponent;
  let fixture: ComponentFixture<TeamBoardComponent>;

  // Mocks für die injizierten Services erstellen
  let mockTodoService: any;
  let mockTeamService: any;
  let mockProjectService: any;
  let mockFilterService: any;
  let mockTodoQueryService: any;
  let mockUserService: any;

  beforeEach(async () => {
    // 1. Wir mocken alle Services mit feinen Vitest-Mock-Funktionen (vi.fn())
    mockTodoService = {
      teamTodos: signal<Todo[]>([]),
      updateTodo: vi.fn()
    };

    mockTeamService = {
      currentProjectMembersSignal: signal([]),
      currentProjectId: signal('project-123'),
      setCurrentProject: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true)
    };

    mockProjectService = {
      setActiveMilestoneId: vi.fn()
    };

    mockFilterService = {
      setInitialCategory: vi.fn(),
      searchTerm: signal('')
    };

    mockTodoQueryService = {
      getProjectIdByMilestoneId: vi.fn().mockReturnValue('project-123'),
      getTodosForProject: vi.fn().mockReturnValue([])
    };

    mockUserService = {
      getCurrentUserId: vi.fn().mockReturnValue('user-admin')
    };

    await TestBed.configureTestingModule({
      imports: [TeamBoardComponent],
      providers: [
        { provide: TodoService, useValue: mockTodoService },
        { provide: TeamService, useValue: mockTeamService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: FilterService, useValue: mockFilterService },
        { provide: TodoQueryService, useValue: mockTodoQueryService },
        { provide: UserService, useValue: mockUserService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeamBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sollte die Komponente erfolgreich erstellen', () => {
    expect(component).toBeTruthy();
  });

  // --- TESTBEREICH 1: FILTER-LOGIK ---
  describe('Filterung und Initialisierung', () => {
    it('sollte am Anfang keinen Filter aktiv haben (Zirkusvorhang geschlossen)', () => {
      expect(component.boardFilter().type).toBeNull();
      expect(component.boardFilter().id).toBeNull();
    });

    it('sollte das Board auf ein Projekt filtern, wenn die Auswahl getroffen wird', () => {
      component.onProjectSelectedFromWelcome('project-123');
      expect(component.boardFilter()).toEqual({ type: 'project', id: 'project-123' });
    });
  });

// --- TESTBEREICH 2: DRAG & DROP WORKFLOWS ---
  describe('Drag & Drop Workflow-Regeln', () => {
    let testTodo: Todo;
    let testViewModel: TodoViewModel;

    beforeEach(() => {
      // 🎪 Wir füttern den Konstruktor genau so, wie deine Klasse es verlangt!
      testTodo = new Todo({
        id: 'task-99',
        task: 'Zirkuszelt fegen',
        teamStatus: 'OPEN',
        assignedUserId: null
      });

      testViewModel = new TodoViewModel(testTodo, false, true, true);
    });

    it('sollte ein Ticket automatisch dem Entwickler zuweisen, wenn es nach IN_PROGRESS verschoben wird', () => {
      const fakeEvent = {
        previousContainer: { data: [testViewModel], id: 'column-open-list' },
        container: { id: 'column-progress-list' },
        previousIndex: 0,
        currentIndex: 0
      } as unknown as CdkDragDrop<TodoViewModel[]>;

      component.onTodoDropped(fakeEvent);

      // Erwartung: Der TodoService wurde aufgerufen
      expect(mockTodoService.updateTodo).toHaveBeenCalled();
      
      // Argument aus dem ersten Aufruf ziehen
      const updatedTodoPassedToService = mockTodoService.updateTodo.mock.calls[0][0] as Todo;
      
      // Überprüfen der Geschäftslogik
      expect(updatedTodoPassedToService.teamStatus).toBe('IN_PROGRESS');
      expect(updatedTodoPassedToService.isStarted).toBe(true);
      expect(updatedTodoPassedToService.assignedUserId).toBe('user-admin'); // Vitest-Power-User!
    });

    it('sollte die Zuweisung komplett löschen, wenn ein Ticket zurück ins BACKLOG geschoben wird', () => {
      testTodo.assignedUserId = 'user-admin';
      testTodo.teamStatus = 'IN_PROGRESS';

      const fakeEvent = {
        previousContainer: { data: [testViewModel], id: 'column-progress-list' },
        container: { id: 'column-backlog-list' },
        previousIndex: 0,
        currentIndex: 0
      } as unknown as CdkDragDrop<TodoViewModel[]>;

      component.onTodoDropped(fakeEvent);

      const updatedTodoPassedToService = mockTodoService.updateTodo.mock.calls[0][0] as Todo;
      
      expect(updatedTodoPassedToService.teamStatus).toBe('BACKLOG');
      expect(updatedTodoPassedToService.assignedUserId).toBeNull(); // Sauber gelöscht!
    });
  });

// 🎪 Eigene saubere Schublade für den Done-Workflow
  describe('Drag & Drop DONE-Workflow', () => {
    // 1. Hier oben deklarieren wir die Variablen, damit sie für ALLE Tests in diesem Block sichtbar sind!
    let localTodo: Todo;
    let movedViewModel: TodoViewModel;

    // 2. Das beforeEach läuft vor jedem einzelnen Test und setzt die Daten frisch zurück
    beforeEach(() => {
      localTodo = new Todo({
        id: 'todo-done-test-123',
        task: 'Test Done Workflow',
        teamStatus: 'REVIEW',
        assignedUserId: 'user-admin'
      });
       localTodo.done = false;

      movedViewModel = new TodoViewModel(
        localTodo,
        false, // descriptionOpen
        true,  // canEdit
        true   // canDelete
      );
    });

    it('sollte bei Verschiebung nach DONE das originale ViewModel nutzen, um das karteninterne Popup zu öffnen', () => {
      // Arrange: Wir spionieren auf der Methode des frisch im beforeEach erstellten ViewModels
      const viewModelSpy = vi.spyOn(movedViewModel, 'onTodoChecked');

      // Event simulieren: Drag & Drop aus der Review-Liste in die DONE-Liste
      const fakeEvent = {
        previousContainer: { data: [movedViewModel], id: 'column-review-list' },
        container: { id: 'column-done-list' },
        previousIndex: 0,
        currentIndex: 0
      } as unknown as CdkDragDrop<TodoViewModel[]>;

      // Act: Verschiebung im Board triggern
      component.onTodoDropped(fakeEvent);

      // Assert:
      // 1. Die Felder auf dem originalen ViewModel-Todo müssen wie in deinem Workflow modifiziert sein
      expect(movedViewModel.todo.teamStatus).toBe('DONE');
      expect(movedViewModel.todo.assignedUserId).toBeNull(); // 🧼 User entfernt
      expect(movedViewModel.todo.completedAt).toBeTruthy();  // Zeitstempel gesetzt

      // 2. DER ENTSCHEIDENDE CHECK: Es muss onTodoChecked auf dem ECHTEN movedViewModel aufgerufen worden sein
      expect(viewModelSpy).toHaveBeenCalledWith(mockTodoService);
      
      // Spion nach dem Test sauber aufräumen
      viewModelSpy.mockRestore();
    });

    // 💡 Hier könnten wir morgen ganz einfach einen zweiten Test reinschreiben,
    // der automatisch mit demselben frischen Setup startet!
  });
});