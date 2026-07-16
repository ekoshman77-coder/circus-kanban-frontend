import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProjectMilestonesComponent } from './project-milestones-component';
import { ProjectService } from '../../../core/services/project-service';
import { TabNavigationService, BoardTab } from '../tab-navigation-service';
import { TodoService } from '../../../core/services/todo/todo-service';
import { FilterService } from '../../../core/services/filter-service';
import { TeamService } from '../../../core/services/team-service';
import { TodoQueryService } from '../../../core/services/todo-query-service';
import { signal } from '@angular/core';
import { Todo } from '../../../core/models/todo';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('ProjectMilestonesComponent (Vitest Edition)', () => {
  let component: ProjectMilestonesComponent;
  let fixture: ComponentFixture<ProjectMilestonesComponent>;

  let mockProjectService: any;
  let mockTabService: any;
  let mockTodoService: any;
  let mockFilterService: any;
  let mockTeamService: any;
  let mockTodoQueryService: any;

  let sampleProjects: any[];
  let sampleTodos: Todo[];

  beforeEach(async () => {
    // 1. Echte Test-Strukturen aufbauen
    sampleProjects = [
      {
        id: 'proj-magic',
        title: 'Die Große Zaubershow',
        milestones: [
          { id: 'ms-setup', title: 'Bühnenaufbau', duration: 10, usedDuration: 2, isCompleted: () => false },
          { id: 'ms-rehearsal', title: 'Generalprobe', duration: 5, usedDuration: 0, isCompleted: () => false }
        ]
      }
    ];

    // 🔥 KORREKTUR: Wir nutzen echte Todo-Instanzen, damit getVisualStatus() existiert!
    sampleTodos = [
      new Todo({ 
        id: 'todo-1', 
        task: 'Kaninchen füttern', 
        done: false, 
        milestoneId: 'ms-setup', 
        dueDate: Date.now() + 86400000 // Morgen fällig -> Status PENDING
      }),
      new Todo({ 
        id: 'todo-2', 
        task: 'Zylinder polieren', 
        done: true, 
        milestoneId: 'ms-setup', 
        dueDate: Date.now() + 86400000,
        completedAt: Date.now()
      }),
      new Todo({ 
        id: 'todo-free', 
        task: 'Popcorn besorgen', 
        done: false, 
        milestoneId: null 
      })
    ];

    // 2. Mocking-Fabrik anschmeißen
    mockProjectService = {
      projectsList: signal<any[]>(sampleProjects)
    };

    mockTabService = {
      currentNavigationState: signal<any>(null),
      changeTab: vi.fn()
    };

    mockTodoService = {
      milestoneBoardTodos: signal<Todo[]>(sampleTodos),
      updateTodo: vi.fn()
    };

    mockFilterService = {
      setInitialCategory: vi.fn()
    };

    mockTeamService = {
      setCurrentProject: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true)
    };

    mockTodoQueryService = {};

    // 3. TestBed aufsetzen
    await TestBed.configureTestingModule({
      imports: [ProjectMilestonesComponent],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: TabNavigationService, useValue: mockTabService },
        { provide: TodoService, useValue: mockTodoService },
        { provide: FilterService, useValue: mockFilterService },
        { provide: TeamService, useValue: mockTeamService },
        { provide: TodoQueryService, useValue: mockTodoQueryService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectMilestonesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Triggert ngOnInit und Konstruktor-Effekte
  });

  // ==========================================================================
  // ⚡ COMPONENT INITIALISIERUNG
  // ==========================================================================
  describe('Initialisierung & Setup', () => {
    it('sollte die Komponente erfolgreich initialisieren', () => {
      expect(component).toBeTruthy();
    });

    it('sollte die Filter-Kategorie im FilterService beim Laden auf "milestones" setzen', () => {
      expect(mockFilterService.setInitialCategory).toHaveBeenCalledWith('milestones');
    });
  });

  // ==========================================================================
  // 🔄 DROPDOWN & FILTER LOGIK
  // ==========================================================================
  describe('Filterung nach Meilenstein & Projekt', () => {
    it('sollte beim direkten Meilensteinwechsel das Zielprojekt ermitteln und die Filter setzen', () => {
      component.onMilestoneChanged('ms-rehearsal');

      expect(component.boardFilter()).toEqual({
        projectId: 'proj-magic',
        milestoneId: 'ms-rehearsal'
      });
      expect(mockTeamService.setCurrentProject).toHaveBeenCalledWith('proj-magic');
    });

    it('sollte das reaktive "currentMatch" korrekt berechnen, wenn Filter aktiv ist', () => {
      component.boardFilter.set({ projectId: 'proj-magic', milestoneId: 'ms-setup' });
      fixture.detectChanges();

      const match = component.currentMatch();
      expect(match).not.toBeNull();
      expect(match?.project.id).toBe('proj-magic');
      expect(match?.milestone.id).toBe('ms-setup');
      expect(match?.milestoneTodos.length).toBe(2);
    });
  });

  // ==========================================================================
  // 🧮 SORTIER- & RISK-ALGORITHMEN
  // ==========================================================================
  describe('Risiko- & LIFO-Sortierungsalgorithmen', () => {
    beforeEach(() => {
      component.boardFilter.set({ projectId: 'proj-magic', milestoneId: 'ms-setup' });
      fixture.detectChanges();
    });

    it('sollte offene Aufgaben oberhalb von erledigten Aufgaben listen', () => {
      const assigned = component.assignedTodos();
      expect(assigned[0].todo.id).toBe('todo-1'); // Offenes Ticket oben
      expect(assigned[1].todo.id).toBe('todo-2'); // Erledigtes Ticket unten
    });

    it('sollte freie, unzugeordnete Aufgaben korrekt filtern', () => {
      const free = component.unassignedTodos();
      expect(free.length).toBe(1);
      expect(free[0].todo.id).toBe('todo-free');
    });

    it('sollte den Fortschritt des aktiven Meilensteins mathematisch korrekt runden', () => {
      expect(component.milestoneProgress()).toBe(50);
    });

    it('sollte den "liveMilestoneStatus" dynamisch auf "In Bearbeitung" stellen', () => {
      expect(component.liveMilestoneStatus()).toBe('⚡️ In Bearbeitung');
    });
  });

  // ==========================================================================
  // 🔐 BERECHTIGUNGEN (canInteractWithTodos)
  // ==========================================================================
  describe('Sicherheits- & Rechtearchitektur', () => {
    beforeEach(() => {
      component.boardFilter.set({ projectId: 'proj-magic', milestoneId: 'ms-setup' });
    });

    it('sollte Interaktionen erlauben, wenn der TeamService grünes Licht gibt', () => {
      mockTeamService.hasPermission.mockReturnValue(true);
      expect(component.canInteractWithTodos()).toBe(true);
    });

    it('sollte Interaktionen blockieren, wenn dem User das Editier-Recht fehlt', () => {
      mockTeamService.hasPermission.mockReturnValue(false);
      expect(component.canInteractWithTodos()).toBe(false);
    });
  });

  // ==========================================================================
  // 🏗️ DRAG & DROP & MANUELLE OPERATIONEN
  // ==========================================================================
  describe('Zuweisungs-Operationen & Drag & Drop', () => {
    beforeEach(() => {
      vi.spyOn(Todo, 'fromTodo').mockImplementation((input: any) => ({ ...input } as any));
      component.boardFilter.set({ projectId: 'proj-magic', milestoneId: 'ms-setup' });
    });

    it('sollte eine Aufgabe erfolgreich entkoppeln (auf null setzen)', () => {
      component.removeTodoFromMilestone('todo-1');

      expect(mockTodoService.updateTodo).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'todo-1', milestoneId: null }),
        true
      );
    });

    it('sollte eine freie Aufgabe dem aktuellen Meilenstein zuweisen', () => {
      const freeTodo = sampleTodos[2];
      component.assignTodoToCurrentMilestone(freeTodo);

      expect(mockTodoService.updateTodo).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'todo-free', milestoneId: 'ms-setup' }),
        true
      );
    });

    it('sollte über CDK Drag & Drop ein To-Do im Meilenstein-Container fallen lassen', () => {
      const fakeDragDropEvent = {
        previousContainer: { id: 'free-todo-list' },
        container: { id: 'milestone-todo-list' },
        item: { data: sampleTodos[2] }
      } as unknown as CdkDragDrop<any[]>;

      component.onTodoDropped(fakeDragDropEvent);

      expect(mockTodoService.updateTodo).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'todo-free', milestoneId: 'ms-setup' }),
        true
      );
    });
  });
});