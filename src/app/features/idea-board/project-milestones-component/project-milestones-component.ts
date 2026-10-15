import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../core/services/project/project-service';
import { BoardTab, TabNavigationService } from '../tab-navigation-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { Milestone } from '../../../core/models/milestone';
import { Todo } from '../../../core/models/todo';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TeamService } from '../../../core/services/team/team-service';
import { TodoQueryService } from '../../../core/services/todo/todo-query-service';
import { TodoPlanningModalComponent } from '../../../core/shared/components/todo-planning-modal-component/todo-planning-modal-component';

@Component({
  selector: 'app-project-milestones-component',
  standalone: true,
  imports: [
    CommonModule, 
    MilestoneSelectorComponent, 
    DragDropModule, 
    TodoItemComponent,
    TodoPlanningModalComponent
  ],
  templateUrl: './project-milestones-component.html',
  styleUrl: './project-milestones-component.css',
})
export class ProjectMilestonesComponent implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly tabService = inject(TabNavigationService);
  private readonly todoService = inject(TodoService);
  private readonly filterService = inject(FilterService);
  private readonly teamService = inject(TeamService);
  private readonly todoQueryService = inject(TodoQueryService);

  public readonly boardFilter = signal<{ projectId: string; milestoneId: string } | null>(null);
  public readonly showCreateModal = signal(false);
  
  constructor() {
    effect(() => {
      const navState = this.tabService.currentNavigationState();
      if (!navState) return;

      if (this.projectService.projectsList().length === 0) return;
      
      let success = false;

      if (navState.type === 'milestone') {
        console.log('📥 [Milestones] Reaktiv Meilenstein empfangen! ID:', navState.id);
        success = this.setFilterByMilestoneId(navState.id);
      } 
      else if (navState.type === 'project') {
        console.log('📥 [Milestones] Reaktiv Projekt empfangen! ID:', navState.id);
        success = this.setFilterByProject(navState.id);
      }

      if (success) {
        console.log('📥 [Milestones] Setze Navigationszustand zurück auf null');
        this.tabService.currentNavigationState.set(null);
      }
    });
  }

  public ngOnInit(): void {
    this.filterService.setInitialCategory('milestones');
  }

  private setFilterByProject(projectId: string): boolean {
    const allProjects = this.projectService.projectsList();
    const foundProject = allProjects.find((p) => p.id === projectId);
    console.log('📥 [Milestones] Reaktiv Projekt gefunden:', foundProject);
    
    if (foundProject && foundProject.milestones && foundProject.milestones.length > 0) {
      this.boardFilter.set({
        projectId: projectId,
        milestoneId: foundProject.milestones[0].id
      });
      this.projectService.setActiveProjectId(projectId);
      return true;
    }
    return false;
  }

  private setFilterByMilestoneId(milestoneId: string): boolean {
    const allProjects = this.projectService.projectsList();
    const foundProject = allProjects.find((p) => 
      p.milestones.some((m) => m.id === milestoneId)
    );

    if (foundProject) {
      this.boardFilter.set({
        projectId: foundProject.id,
        milestoneId: milestoneId
      });
      this.projectService.setActiveProjectId(foundProject.id);
      return true;
    }
    return false;
  }

  public onMilestoneChanged(newMilestoneId: string): void {
    console.log('🔍 Dropdown hat Phase gewechselt auf Meilenstein-ID:', newMilestoneId);
    this.setFilterByMilestoneId(newMilestoneId);
  }

  public readonly activeMilestoneId = computed(() => {
    const filter = this.boardFilter();
    return filter ? filter.milestoneId : null;
  });

  public readonly currentMatch = computed(() => {
    const filter = this.boardFilter();
    if (!filter) return null;

    const allProjects = this.projectService.projectsList();
    const allTodos = this.todoService.milestoneBoardTodos();

    const foundProject = allProjects.find((p) => p.id === filter.projectId);
    const foundMilestone = foundProject?.milestones.find((m) => m.id === filter.milestoneId);

    if (!foundProject || !foundMilestone) return null;

    const milestoneTodos = allTodos
      .filter((t) => t.milestoneId === filter.milestoneId)
      .map((t) => new TodoViewModel(t, false));

    return {
      project: foundProject,
      milestone: foundMilestone,
      milestoneTodos: milestoneTodos,
    };
  });

  public readonly assignedTodos = computed(() => {
    const match = this.currentMatch();
    if (!match || !match.milestoneTodos) return [];

    const now = new Date().getTime();

    return match.milestoneTodos.slice().sort((a, b) => {
      const checkedDiff = (a.todo.done ? 1 : 0) - (b.todo.done ? 1 : 0);
      if (checkedDiff !== 0) return checkedDiff;

      const daysLeftA = a.todo.dueDate ? (a.todo.dueDate - now) / (1000 * 60 * 60 * 24) : 100;
      const daysLeftB = b.todo.dueDate ? (b.todo.dueDate - now) / (1000 * 60 * 60 * 24) : 100;

      const effortA = a.effort || 1;
      const effortB = b.effort || 1;

      const riskScoreA = daysLeftA - effortA;
      const riskScoreB = daysLeftB - effortB;

      return riskScoreA - riskScoreB;
    });
  });

  public readonly unassignedTodos = computed(() => {
    const allTodosFromService = this.todoService.milestoneBoardTodos();

    const freeTodos = allTodosFromService
      .filter((t) => !t.milestoneId)
      .map((t) => new TodoViewModel(t, false));

    if (!freeTodos) return [];

    return freeTodos.slice().sort((a, b) => {
      const checkedDiff = (a.todo.done ? 1 : 0) - (b.todo.done ? 1 : 0);
      if (checkedDiff !== 0) return checkedDiff;

      const timeA = a.todo.createdAt ? new Date(a.todo.createdAt).getTime() : 0;
      const timeB = b.todo.createdAt ? new Date(b.todo.createdAt).getTime() : 0;

      return timeB - timeA;
    });
  });
  
  public readonly milestoneProgress = computed(() => {
    const match = this.currentMatch();
    if (!match || match.milestoneTodos.length === 0) return 0;

    const completed = match.milestoneTodos.filter((t) => t.todo.done).length;
    return Math.round((completed / match.milestoneTodos.length) * 100);
  });

  public readonly liveMilestoneStatus = computed(() => {
    const match = this.currentMatch();
    if (!match) return 'Unbekannt';

    const total = match.milestoneTodos.length;
    if (total === 0) return 'Keine Aufgaben';

    const completed = match.milestoneTodos.filter((t) => t.todo.done).length;

    if (completed === total) return '🎉 Erledigt';
    if (completed > 0) return '⚡️ In Bearbeitung';
    return '📅 Geplant';
  });

  public removeTodoFromMilestone(todoId: string): void {
    const todo = this.todoService.milestoneBoardTodos().find((t) => t.id === todoId);
    if (todo) {
      const updatedTodo = Todo.fromTodo(todo);
      updatedTodo.milestoneId = null;
      this.todoService.updateTodo(updatedTodo, true);
    }
  }

  public assignTodoToCurrentMilestone(todo: Todo): void {
    const currentMsId = this.activeMilestoneId();
    if (!todo || !currentMsId) return;

    const updatedTodo = Todo.fromTodo(todo);
    updatedTodo.milestoneId = currentMsId;
    this.todoService.updateTodo(updatedTodo, true);
  }

  public onTodoDropped(event: CdkDragDrop<TodoViewModel[]>): void {
    if (event.previousContainer === event.container) {
      return;
    }

    const movedTodo = event.item.data as Todo;
    const currentMsId = this.activeMilestoneId();

    if (!movedTodo) return;

    const updatedTodo = Todo.fromTodo(movedTodo);

    if (event.container.id === 'milestone-todo-list') {
      updatedTodo.milestoneId = currentMsId;
    } else if (event.container.id === 'free-todo-list') {
      updatedTodo.milestoneId = null;
    }

    this.todoService.updateTodo(updatedTodo, true);
  }

  public openTeamBoardForMilestone(milestoneId: string): void {
    this.tabService.changeTab(BoardTab.team, {
      type: 'milestone',
      id: milestoneId
    });
  }

public canInteractWithTodos(): boolean {
    const match = this.currentMatch();
    
    // 1. Primärer Pfad: Direkt über das gematchte Projekt
    if (match?.project) {
      return this.projectService.hasPermission(match.project.id, 'PROJECT_EDIT');
    }

    // 2. Fallback: Über den aktiven Meilenstein suchen
    const activeMsId = this.activeMilestoneId();
    if (!activeMsId) return false;

    const foundProject = this.projectService.projectsList().find((p) => 
      p.milestones?.some((m) => m.id === activeMsId)
    );
    if (!foundProject) return false;

    return this.projectService.hasPermission(foundProject.id, 'PROJECT_EDIT');
  }
  
  public openModalForm(): void {
    if (this.canInteractWithTodos()) {
      console.log('✨ [Modal] Öffne Formular für neue Aufgabe...');
      this.showCreateModal.set(true);
    }
  }

  public closeModalForm(): void {
    console.log('🧼 [Modal] Schließe Formular.');
    this.showCreateModal.set(false);
  }
}