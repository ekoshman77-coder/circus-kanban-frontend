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

describe('TeamBoardComponent (Erweiterte Business-Regeln)', () => {
  let component: TeamBoardComponent;
  let fixture: ComponentFixture<TeamBoardComponent>;

  let mockTodoService: any;
  let mockTeamService: any;
  let mockProjectService: any;
  let mockFilterService: any;
  let mockTodoQueryService: any;
  let mockUserService: any;

  beforeEach(async () => {
    mockTodoService = {
      teamTodos: signal<Todo[]>([]),
      updateTodo: vi.fn(),
      toggleComplete: vi.fn()
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

  describe('🧠 Das Ticket-Gedächtnis & Spalten-Workflows', () => {
    let testTodo: Todo;
    let testViewModel: TodoViewModel;

    beforeEach(() => {
      testTodo = new Todo({
        id: 'task-zirkus',
        task: 'Jonglieren üben',
        teamStatus: 'OPEN',
        assignedUserId: null
      });
      testViewModel = new TodoViewModel(testTodo, false, true, true);
    });

    it('sollte beim Schieben nach REVIEW die Zuweisung löschen, aber den Macher im Gedächtnis sichern', () => {
      // Vorbereitung: Ticket ist gerade bei einem Entwickler in Arbeit
      testTodo.assignedUserId = 'developer-elena';
      testTodo.teamStatus = 'IN_PROGRESS';

      const fakeEvent = {
        previousContainer: { data: [testViewModel], id: 'column-progress-list' },
        container: { id: 'column-review-list' },
        previousIndex: 0,
        currentIndex: 0
      } as unknown as CdkDragDrop<TodoViewModel[]>;

      component.onTodoDropped(fakeEvent);

      const updatedTodo = mockTodoService.updateTodo.mock.calls[0][0] as Todo;
      
      expect(updatedTodo.teamStatus).toBe('REVIEW');
      expect(updatedTodo.assignedUserId).toBeNull(); // 🧼 Zuweisung gelöscht, damit andere reviewen können!
      expect(updatedTodo.lastDeveloperId).toBe('developer-elena'); // 🧠 Im Gedächtnis behalten!
    });

    it('sollte den lastDeveloper automatisch re-aktivieren, wenn das Ticket aus dem Review zurückgeworfen wird', () => {
      // Vorbereitung: Ticket kommt aus dem Review und hat Elena im Gedächtnis gespeichert
      testTodo.assignedUserId = null;
      testTodo.lastDeveloperId = 'developer-elena';
      testTodo.teamStatus = 'REVIEW';

      const fakeEvent = {
        previousContainer: { data: [testViewModel], id: 'column-review-list' },
        container: { id: 'column-progress-list' },
        previousIndex: 0,
        currentIndex: 0
      } as unknown as CdkDragDrop<TodoViewModel[]>;

      component.onTodoDropped(fakeEvent);

      const updatedTodo = mockTodoService.updateTodo.mock.calls[0][0] as Todo;
      
      expect(updatedTodo.teamStatus).toBe('IN_PROGRESS');
      expect(updatedTodo.assignedUserId).toBe('developer-elena'); // 🔄 Elena kriegt es automatisch zurück!
    });

    it('sollte die Zuweisung komplett löschen, wenn das Ticket nach OPEN, BACKLOG oder DONE geschoben wird', () => {
      testTodo.assignedUserId = 'developer-elena';
      testTodo.teamStatus = 'IN_PROGRESS';

      const fakeEventToOpen = {
        previousContainer: { data: [testViewModel], id: 'column-progress-list' },
        container: { id: 'column-open-list' },
        previousIndex: 0,
        currentIndex: 0
      } as unknown as CdkDragDrop<TodoViewModel[]>;

      component.onTodoDropped(fakeEventToOpen);

      const updatedTodo = mockTodoService.updateTodo.mock.calls[0][0] as Todo;
      expect(updatedTodo.teamStatus).toBe('OPEN');
      expect(updatedTodo.assignedUserId).toBeNull(); // 🧼 Gelöscht!
    });
  });

  describe('🟢 Der DONE-Workflow & Punkte-Popup', () => {
    it('sollte beim Verschieben nach DONE die Aufwandspunkte-Abfrage direkt über das ViewModel triggern', () => {
      const doneTodo = new Todo({
        id: 'task-done',
        task: 'Popcorn-Maschine reinigen',
        teamStatus: 'REVIEW',
        assignedUserId: 'developer-elena'
      });
      const doneViewModel = new TodoViewModel(doneTodo, false, true, true);
      const viewModelSpy = vi.spyOn(doneViewModel, 'onTodoChecked');

      const fakeEvent = {
        previousContainer: { data: [doneViewModel], id: 'column-review-list' },
        container: { id: 'column-done-list' },
        previousIndex: 0,
        currentIndex: 0
      } as unknown as CdkDragDrop<TodoViewModel[]>;

      component.onTodoDropped(fakeEvent);

      // Status-Anpassungen prüfen
      expect(doneViewModel.todo.teamStatus).toBe('DONE');
      expect(doneViewModel.todo.assignedUserId).toBeNull(); // 🧼 Bei Done wird der User entfernt
      
      // Wichtig: Das karteninterne Popup muss getriggert worden sein!
      expect(viewModelSpy).toHaveBeenCalledWith(mockTodoService);
    });
  });
});