import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../../core/services/project/project-service';
import { BoardTab, TabNavigationService } from '../tab-navigation-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { Milestone } from '../../../core/models/milestone';
import { Todo } from '../../../core/models/todo';
import { TodoFormComponent } from '../../../core/shared/components/todo-form/todo-form';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TeamService } from '../../../core/services/team/team-service';
import { TodoQueryService } from '../../../core/services/todo/todo-query-service';
import { TodoPlanningModalComponent } from '../../../core/shared/components/todo-planning-modal-component/todo-planning-modal-component';

/**
 * @component ProjectMilestonesComponent
 * @description
 * Eine interaktive Splitscreen-Oberfläche zur strategischen Meilenstein-Planung.
 * Erlaubt die Zuweisung von globalen Aufgaben an spezifische Projektphasen (Meilensteine)
 * per Drag & Drop (Angular CDK) sowie die reaktive Risikobewertung von Aufgaben.
 */
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
  // --- Injektion der zentralen Core-Services ---
  private readonly projectService = inject(ProjectService);
  private readonly tabService = inject(TabNavigationService);
  private readonly todoService = inject(TodoService);
  private readonly filterService = inject(FilterService);
  private readonly teamService = inject(TeamService);
  private readonly todoQueryService = inject(TodoQueryService);

  /** 🎯 Der aktive Filter-Zustand des Boards (Projekt-ID und Meilenstein-ID) */
  public readonly boardFilter = signal<{ projectId: string; milestoneId: string } | null>(null);
  
  /** 🧼 Steuerungs-Signal für das Aufgaben-Erstellungs-Modal */
  public readonly showCreateModal = signal<boolean>(false);
  
  constructor() {
    /**
     * @effect NavigationSync
     * Reagiert auf eingehende Navigationsdaten aus anderen Boards (z. B. Projektdetails)
     * und synchronisiert den aktiven Filter-Zustand der Meilenstein-Ansicht.
     */
    effect(() => {
      const navState = this.tabService.currentNavigationState();
      if (!navState) return;

      if (this.projectService.projectsList().length === 0) return;
      
      let success = false;

      // Fall A: Es kommt direkt eine Meilenstein-ID über die Navigation
      if (navState.type === 'milestone') {
        console.log('📥 [Milestones] Reaktiv Meilenstein empfangen! ID:', navState.id);
        success = this.setFilterByMilestoneId(navState.id);
      } 
      // Fall B: Es kommt eine Projekt-ID -> Ersten Meilenstein dieses Projekts aktivieren
      else if (navState.type === 'project') {
        console.log('📥 [Milestones] Reaktiv Projekt empfangen! ID:', navState.id);
        success = this.setFilterByProject(navState.id);
      }

      // Zustand erst leeren, wenn die Zuweisung erfolgreich geklappt hat
      if (success) {
        console.log('📥 [Milestones] Setze Navigationszustand zurück auf null');
        this.tabService.currentNavigationState.set(null);
      }
    });
  }

  public ngOnInit(): void {
    this.filterService.setInitialCategory('milestones');
  }

  /** Setzt den aktiven Board-Filter basierend auf dem ersten Meilenstein eines Projekts */
  private setFilterByProject(projectId: string): boolean {
    const allProjects = this.projectService.projectsList();
    const foundProject = allProjects.find((p) => p.id === projectId);
    console.log('📥 [Milestones] Reaktiv Projekt gefunden:', foundProject);
    
    if (foundProject && foundProject.milestones && foundProject.milestones.length > 0) {
      this.boardFilter.set({
        projectId: projectId,
        milestoneId: foundProject.milestones[0].id
      });
      console.log('📥 [Milestones] Filter erfolgreich gesetzt:', this.boardFilter());
      this.teamService.setCurrentProject(projectId);
      return true;
    }
    return false;
  }

  /** Setzt den Filter basierend auf einer Meilenstein-ID und verknüpft sie mit dem übergeordneten Projekt */
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
      this.teamService.setCurrentProject(foundProject.id);
      return true;
    }
    return false;
  }

  /** Wird vom Dropdown-Auswahlelement gefeuert, um die aktive Phase manuell zu wechseln */
  public onMilestoneChanged(newMilestoneId: string): void {
    console.log('🔍 Dropdown hat Phase gewechselt auf Meilenstein-ID:', newMilestoneId);
    this.setFilterByMilestoneId(newMilestoneId);
  }

  /** Gibt die aktive Meilenstein-ID für Dropdowns und Formular-Komponenten im Template aus */
  public readonly activeMilestoneId = computed(() => {
    const filter = this.boardFilter();
    return filter ? filter.milestoneId : null;
  });

  /**
   * @property currentMatch
   * @description Reaktiver Kern des Meilenstein-Planers.
   * Holt das aktive Projekt, die aktive Phase (Meilenstein) und alle dieser Phase 
   * zugewiesenen Aufgaben aus den globalen Stores und fasst sie in einem einheitlichen Objekt zusammen.
   */
  public readonly currentMatch = computed(() => {
    console.log('📥 [Milestones] currentMatch gestartet. boardFilter = ', this.boardFilter());

    const filter = this.boardFilter();
    if (!filter) return null;

    const allProjects = this.projectService.projectsList();
    const allTodos = this.todoService.milestoneBoardTodos();

    const foundProject = allProjects.find((p) => p.id === filter.projectId);
    const foundMilestone = foundProject?.milestones.find((m) => m.id === filter.milestoneId);

    if (!foundProject || !foundMilestone) return null;

    console.log('📥 [Milestones] currentMatch: Projekt und Meilenstein erfolgreich zugeordnet.');

    const milestoneTodos = allTodos
      .filter((t) => t.milestoneId === filter.milestoneId)
      .map((t) => new TodoViewModel(t, false));

    return {
      project: foundProject,
      milestone: foundMilestone,
      milestoneTodos: milestoneTodos,
    };
  });

  /**
   * @property assignedTodos
   * @description Sortiert alle zugewiesenen Aufgaben reaktiv nach einer Risikomatrix:
   * 1. Offene Aufgaben stehen grundlegend über abgeschlossenen Aufgaben.
   * 2. Offene Aufgaben werden nach Risiko-Dringlichkeit sortiert: (Pufferzeit in Tagen minus geschätzter Aufwand).
   */
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

  /**
   * @property unassignedTodos
   * @description Holt alle im System registrierten "freien" Aufgaben (milestoneId === null)
   * und sortiert sie reaktiv nach LIFO (Zuletzt erstellt steht ganz oben).
   */
public readonly unassignedTodos = computed(() => {
  const allTodosFromService = this.todoService.milestoneBoardTodos();
  
  // 🔍 Detektiv-Log: Zeigt uns im Browser genau, wie viele Todos überhaupt ankommen!
  console.log('🕵️‍♂️ Pool im Milestone-Board:', allTodosFromService.length, 'Todos gesamt.');

  const freeTodos = allTodosFromService
 //   .filter((t) => t.milestoneId === null || t.milestoneId === undefined || t.milestoneId === '')
    .filter((t) => !t.milestoneId)
    .map((t) => new TodoViewModel(t, false));

  if (!freeTodos) return [];

  // Logge die IDs der freien Todos, um zu sehen, wer es geschafft hat
  console.log('🎯 Davon als "frei" erkannt:', freeTodos.length);

  return freeTodos.slice().sort((a, b) => {
    const checkedDiff = (a.todo.done ? 1 : 0) - (b.todo.done ? 1 : 0);
    if (checkedDiff !== 0) return checkedDiff;

    const timeA = a.todo.createdAt ? new Date(a.todo.createdAt).getTime() : 0;
    const timeB = b.todo.createdAt ? new Date(b.todo.createdAt).getTime() : 0;

    return timeB - timeA;
  });
});
  
  /** Berechnet den aktuellen Fortschritt der aktiven Phase in Prozent */
  public readonly milestoneProgress = computed(() => {
    const match = this.currentMatch();
    if (!match || match.milestoneTodos.length === 0) return 0;

    const completed = match.milestoneTodos.filter((t) => t.todo.done).length;
    return Math.round((completed / match.milestoneTodos.length) * 100);
  });

  /** Übersetzt den aktuellen Meilenstein-Status in nutzerfreundliche Badge-Texte */
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

  /** Entkoppelt ein To-Do vom Meilenstein (setzt milestoneId zurück auf null) */
  public removeTodoFromMilestone(todoId: string): void {
    const todo = this.todoService.milestoneBoardTodos().find((t) => t.id === todoId);
    if (todo) {
      const updatedTodo = Todo.fromTodo(todo);
      updatedTodo.milestoneId = null;
      this.todoService.updateTodo(updatedTodo, true);
    }
  }

  /** Weist eine freie Aufgabe dem aktuell ausgewählten Meilenstein zu */
  public assignTodoToCurrentMilestone(todo: Todo): void {
    const currentMsId = this.activeMilestoneId();
    if (!todo || !currentMsId) return;

    const updatedTodo = Todo.fromTodo(todo);
    updatedTodo.milestoneId = currentMsId;
    this.todoService.updateTodo(updatedTodo, true);
  }

  /** Drag & Drop Handler aus dem Angular CDK DragDropModule */
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

  /** Führt eine direkte Tab-Navigation zum Team-Board der ausgewählten Phase aus */
  public openTeamBoardForMilestone(milestoneId: string): void {
    this.tabService.changeTab(BoardTab.team, {
      type: 'milestone',
      id: milestoneId
    });
  }

  /** 🔒 ZENTRALE SICHERHEITSPRÜFUNG FÜR DIE INTERAKTION MIT AUFGABEN */
  public canInteractWithTodos(): boolean {
    const allProjects = this.projectService.projectsList();
    const foundProject = allProjects.find((p) => 
      p.milestones.some((m) => m.id === this.activeMilestoneId())
    );
    if (!foundProject) {
      return false;
    }
    const hasPermission = this.teamService.hasPermission(foundProject.id, 'MILESTONE_EDIT');
    console.log("canInteractWithTodos :: Berechtigungsergebnis: ", hasPermission);
    return hasPermission; 
  }

  /** Öffnet das Erstellungsformular für neue To-Dos nach erfolgreicher Rechteprüfung */
  public openModalForm(): void {
    if (this.canInteractWithTodos()) {
      console.log('✨ [Modal] Öffne Formular für neue Aufgabe...');
      this.showCreateModal.set(true);
    }
  }

  /** Schließt das Erstellungsformular für neue To-Dos im UI */
  public closeModalForm(): void {
    console.log('🧼 [Modal] Schließe Formular.');
    this.showCreateModal.set(false);
  }
}