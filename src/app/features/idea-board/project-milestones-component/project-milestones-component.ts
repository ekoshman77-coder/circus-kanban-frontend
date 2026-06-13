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

  // Das manuelle Signal für die Dropdown-Suche
  private manualMilestoneId = signal<string | null>(null);

  constructor() {
    /**
     * 🕹️ ZURÜCKSETZEN BEI TAB-WECHSEL:
     * Sobald der User irgendwohin navigiert, löschen wir die manuelle ID,
     * damit die automatische Routen-Erkennung wieder greift.
     */
    effect(() => {
      this.tabService.currentNavigationState(); 
      this.manualMilestoneId.set(null);         
    });
  }

  // 🎯 UNVERKNOTETE LIVE-BERECHNUNG: 
  // Holt sich die Todos aus dem stabilen currentMatch() und gibt sie an die
  // reinen Rechen-Funktionen des ProjectService weiter!
  public liveMilestoneStatus = computed(() => {
    const match = this.currentMatch();
    if (!match) return 'Offen';
    return this.projectService.calculateMilestoneStatus(match.milestoneTodos);
  });

  public milestoneProgress = computed(() => {
    const match = this.currentMatch();
    if (!match) return 0;
    return this.projectService.calculateMilestoneProgress(match.milestoneTodos);
  });

  /**
   * 🗺️ ID-ERMITTLUNG:
   * Findet heraus, welcher Meilenstein gerade aktiv sein sollte (Route oder Klick)
   */
  public activeMilestoneId = computed(() => {
    if (this.manualMilestoneId()) {
      return this.manualMilestoneId();
    }

    const navState = this.tabService.currentNavigationState();
    if (!navState) return null;

    const allProjects = this.projectService.projectsList();

    if (navState.type === 'milestone') {
      return navState.id;
    }

    if (navState.type === 'project') {
      const linkedProject = allProjects.find(p => p.id === navState.id);
      if (linkedProject && linkedProject.milestones.length > 0) {
        return linkedProject.milestones[0].id;
      }
    }

    return null;
  });

  /**
   * 🔍 DAS MATCH-HERZSTÜCK:
   * Sucht das Projekt, den Meilenstein und alle zugehörigen Aufgaben aus dem RAM.
   */
  public currentMatch = computed(() => {
    const milestoneId = this.activeMilestoneId();
    if (!milestoneId) return null;

    const allProjects = this.projectService.projectsList();

    for (const proj of allProjects) {
      const foundMs = proj.milestones.find(ms => ms.id === milestoneId);

      if (foundMs) {
        // Filtere alle To-Dos, die zu diesem Meilenstein gehören
        const matchingTodos = this.todoService.allTodos().filter(todo => todo.milestoneId === foundMs.id);
        const viewModels = matchingTodos.map(todo => new TodoViewModel(todo, false));
        const clonedMilestone = Milestone.fromMilestone(foundMs);

        return {
          project: proj,
          milestone: clonedMilestone,
          milestoneTodos: viewModels
        };
      }
    }
    return null;
  });

  // Wenn der Benutzer im Dropdown einen anderen Meilenstein wählt
  public onMilestoneChanged(id: string | null): void {
    this.manualMilestoneId.set(id);
  }

  // Entfernt ein To-Do aus dem aktuellen Meilenstein (macht es wieder frei)
  public removeTodoFromMilestone(todoId: string): void {
    const todo = this.todoService.allTodos().find(t => t.id === todoId);
    if (!todo) return;
    
    const updatedTodo = Todo.fromTodo(todo);
    updatedTodo.milestoneId = null;
    this.todoService.updateTodo(updatedTodo);
  }

  // Erstellt eine brandneue Aufgabe direkt für diesen Meilenstein
  public createTodoForMilestone(taskInput: HTMLInputElement): void {
    const taskText = taskInput.value.trim();
    if (!taskText) return;

    const currentMs = this.currentMatch();
    if (!currentMs || !currentMs.milestone) return;

    this.todoService.createAndAddTodo({
      task: taskText,
      milestoneId: currentMs.milestone.id,
      effort: 1,
      dueDate: Date.now() + 86400000,
      description: "",
      isStarted: false
    });

    taskInput.value = "";
  }

  // Listet alle Aufgaben auf, die noch KEINEM Meilenstein zugeordnet sind
  public unassignedTodos = computed<TodoViewModel[]>(() => {
    const rawTodos = this.todoService.allTodos().filter(todo => !todo.milestoneId);
    return rawTodos.map(todo => new TodoViewModel(todo, false));
  });

  // Ordnet ein freies To-Do dem Meilenstein zu (per Klick oder Button)
  public assignTodoToMilestone(todoId: string): void {
    const todo = this.todoService.allTodos().find(t => t.id === todoId);
    const currentMsId = this.activeMilestoneId();

    if (!todo || !currentMsId) return;

    const updatedTodo = Todo.fromTodo(todo);
    updatedTodo.milestoneId = currentMsId;
    this.todoService.updateTodo(updatedTodo);
  }

  /**
   * 🏃‍♂️ DRAG & DROP WORKSPACE:
   * Schiebt Aufgaben reaktiv zwischen dem Meilenstein und der freien Liste hin und her!
   */
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

    // Ab ins Backend und in den Todo-State. 
    // Durch die Signal-Abhängigkeit in 'currentMatch' aktualisiert sich 
    // danach der Status auf dem Bildschirm sofort von ganz alleine!
    this.todoService.updateTodo(updatedTodo);
  }

  public openTeamBoardForMilestone(milestoneId: string): void {
    console.log('🎪 Navigiere zum Team-Kanban für Meilenstein:', milestoneId);

    // Hier zünden wir die Steuer-Zentrale!
    // Typ ist 'milestone' und wir nehmen die echte Meilenstein-ID mit!
    this.tabService.changeTab(BoardTab.team, {
      type: 'milestone',
      id: milestoneId
    });
  }
}