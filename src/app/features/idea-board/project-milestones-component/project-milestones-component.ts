import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../core/services/project-service';
import { BoardTab, TabNavigationService } from '../tab-navigation-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { Milestone } from '../../../core/models/milestone';
import { Todo } from '../../../core/models/todo';
import { TodoFormComponent } from '../../../core/shared/components/todo-form/todo-form';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';

@Component({
  selector: 'app-project-milestones-component',
  standalone: true,
  imports: [CommonModule, MilestoneSelectorComponent, TodoFormComponent, DragDropModule, TodoItemComponent],
  templateUrl: './project-milestones-component.html',
  styleUrl: './project-milestones-component.css',
})
export class ProjectMilestonesComponent {
  private projectService = inject(ProjectService);
  private tabService = inject(TabNavigationService);
  private todoService = inject(TodoService);

  // 🎯 UNSER SAUBERER BOARDFILTER
  public boardFilter = signal<{ projectId: string; milestoneId: string } | null>(null);

  constructor() {
    // 🚀 DER INTELLIGENTE EMPFÄNGER: Reagiert stabil auf eintreffende Daten
    effect(() => {
      const navState = this.tabService.currentNavigationState();
      if (!navState) return;

      const allProjects = this.projectService.projectsList();
      // Falls die Projektdaten noch nicht geladen sind, warten wir reaktiv auf den nächsten Cycle!
      if (allProjects.length === 0) return; 

      let success = false;

      // Fall A: Es kommt direkt eine Meilenstein-ID
      if (navState.type === 'milestone') {
        console.log('📥 [Milestones] Reaktiv Meilenstein empfangen! ID:', navState.id);
        success = this.setFilterByMilestoneId(navState.id);
      } 
      // Fall B: Es kommt eine Projekt-ID -> 1. Meilenstein aktivieren
      else if (navState.type === 'project') {
        console.log('📥 [Milestones] Reaktiv Projekt empfangen! ID:', navState.id);
        const foundProject = allProjects.find((p) => p.id === navState.id);
        console.log('📥 [Milestones] Reaktiv Projekt gefunden:', foundProject);
        
        if (foundProject && foundProject.milestones && foundProject.milestones.length > 0) {
          this.boardFilter.set({
            projectId: navState.id,
            milestoneId: foundProject.milestones[0].id
          });
          console.log('📥 [Milestones] filter gesetzt', this.boardFilter());
          success = true;
        }
      }

      // WICHTIG: Nur löschen, wenn wir die Zuordnung erfolgreich verarbeitet haben!
      if (success) {
        console.log('📥 [Milestones] set navigation state to null');
        this.tabService.currentNavigationState.set(null);
      }
    });
  }

  /**
   * Sucht das passende Projekt zu einer Meilenstein-ID und setzt den Board-Filter.
   * Gibt true zurück, wenn die Zuordnung erfolgreich war.
   */
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
      return true;
    }
    return false;
  }

  /**
   * 🔄 DROPDOWN-WECHSEL: Nutzt jetzt exakt die gleiche private Funktion!
   */
  public onMilestoneChanged(newMilestoneId: string): void {
    console.log('🔍 Dropdown hat Phase gewechselt auf Meilenstein-ID:', newMilestoneId);
    this.setFilterByMilestoneId(newMilestoneId);
  }

  /**
   * 🌟 DIE HILFS-ID FÜR FORMULARE UND SELECTOREN
   */
  public activeMilestoneId = computed(() => {
    const filter = this.boardFilter();
    return filter ? filter.milestoneId : null;
  });

  /**
   * 🗺️ DAS REAKTIVE ZENTRAL-GEHIRN
   */
  public currentMatch = computed(() => {
    console.log('📥 [Milestones] currentMatch start. boardFilter = ', this.boardFilter());

    const filter = this.boardFilter();
    if (!filter) return null;

    const allProjects = this.projectService.projectsList();
    const allTodos = this.todoService.allTodos();

    const foundProject = allProjects.find((p) => p.id === filter.projectId);
    const foundMilestone = foundProject?.milestones.find((m) => m.id === filter.milestoneId);

    if (!foundProject || !foundMilestone) return null;

    console.log('📥 [Milestones] currentMatch project und milestone sind gefunden');

    const milestoneTodos = allTodos
      .filter((t) => t.milestoneId === filter.milestoneId)
      .map((t) => new TodoViewModel(t, false));

    console.log('📥 [Milestones] alle todos', allTodos);
    console.log('📥 [Milestones] holt todos for milestone', milestoneTodos);

    return {
      project: foundProject,
      milestone: foundMilestone,
      milestoneTodos: milestoneTodos,
    };
  });

  public unassignedTodos = computed(() => {
    return this.todoService
      .allTodos()
      .filter((t) => t.milestoneId === null)
      .map((t) => new TodoViewModel(t, false));
  });

  public milestoneProgress = computed(() => {
    const match = this.currentMatch();
    if (!match || match.milestoneTodos.length === 0) return 0;

    const completed = match.milestoneTodos.filter((t) => t.todo.done).length;
    return Math.round((completed / match.milestoneTodos.length) * 100);
  });

  public liveMilestoneStatus = computed(() => {
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
    const todo = this.todoService.allTodos().find((t) => t.id === todoId);
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
}