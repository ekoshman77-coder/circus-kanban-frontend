import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service';
import { TeamService } from '../../../core/services/team-service';
import { Todo } from '../../../core/models/todo';
import { TabNavigationService } from '../tab-navigation-service';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { ProjectService } from '../../../core/services/project-service';
import { FilterService } from '../../../core/services/filter-service';
import { TodoQueryService } from '../../../core/services/todo-query-service';
import { TodoPlanningModalComponent } from '../../../core/shared/components/todo-planning-modal-component/todo-planning-modal-component';
import { UserService } from '../../../core/services/user/user-service';

/**
 * Definiert den Filterzustand für das Kanban-Board.
 * Kann entweder auf ein ganzes Projekt oder einen spezifischen Meilenstein gefiltert sein.
 */
export type BoardFilterState = {
  type: 'project' | 'milestone' | null;
  id: string | null;
};

/**
 * @class TeamBoardComponent
 * @description 
 * Das interaktive Herzstück der Team-Zusammenarbeit im edlen Zirkus-Design.
 * 
 * **Hauptaufgaben der Komponente:**
 * * **Statusverwaltung:** Steuert das 5-Spalten-Kanban-System (Workflow-Zustände von BACKLOG bis DONE)[cite: 2, 3].
 * * **Ticket-Lebenszyklus:** Regelt das reaktive Drag & Drop, wendet automatisierte Workflow-Regeln an (z. B. automatisches Zuweisen/Freigeben von Entwicklern)[cite: 3].
 * * **Zuweisung & Bearbeitung:** Verwaltet die Zuweisung von Team-Mitgliedern zu spezifischen Aufgaben[cite: 3].
 * * **Reaktive Filterung:** Filtert Aufgaben nahtlos nach Projekt oder Meilenstein in Echtzeit via Angular Signals[cite: 3].
 */
@Component({
  selector: 'app-team-board',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    TodoItemComponent, 
    DragDropModule, 
    MilestoneSelectorComponent, 
    TodoPlanningModalComponent
  ],
  templateUrl: './team-board-component.html',
  styleUrl: './team-board-component.css'
})
export class TeamBoardComponent implements OnInit {
  // --- Services ---
  public readonly todoService = inject(TodoService);
  public readonly teamService = inject(TeamService);
  public readonly navigationService = inject(TabNavigationService);
  private readonly projectService = inject(ProjectService);
  private readonly filterService = inject(FilterService);
  private readonly todoQueryService = inject(TodoQueryService);
  private readonly userService = inject(UserService);

  // --- UI-Steuerung (Signals) ---
  /** Signal zur Steuerung der Sichtbarkeit des Planungs-Modals */
  public readonly showPlanningModal = signal<boolean>(false);
  
  /** Hält das Todo-Objekt, das gerade auf Punkte-Bestätigung wartet (z.B. beim Verschieben nach DONE) */
  public readonly todoWaitingForPopup = signal<Todo | null>(null);
  
  /** Temporärer Schätzwert im Punkte-Popup */
  public readonly popupEffortValue = signal<number>(0);
  
  /** Signal zur Steuerung des Punkteeingabe-Popups beim Erledigen einer Aufgabe */
  public readonly showEffortPopup = signal<boolean>(false);

  /** Der aktive Board-Filter (Projekt oder Meilenstein) */
  public readonly boardFilter = signal<BoardFilterState>({ type: null, id: null });

  // --- Permissions & Projekt-Mitglieder (Reaktiv) ---
  private readonly currentProjectId = signal<string>("");
  
  /** Liefert die ID des aktuell gefilterten Meilensteins oder einen Leerstring */
  public readonly currentMilestioneId = computed(() => {
    return (this.boardFilter().type === 'milestone') ? this.boardFilter().id : ""; 
  });
  
  public readonly currentProjectMembers = this.teamService.currentProjectMembersSignal;

  /** Extrahiert die zuweisbaren User aus den aktuellen Projekt-Mitgliedern */
  public readonly assignableUsers = computed(() => {
    return this.currentProjectMembers().map(member => member.user);
  });

  /** Prüft, ob der aktuelle User Schreibrechte (Editieren) im aktuellen Projekt besitzt */
  public readonly canEdit = computed(() => {
    return this.teamService.hasPermission(this.currentProjectId(), 'TODO_EDIT');
  });

  /** Prüft, ob der aktuelle User Löschrechte im aktuellen Projekt besitzt */
  public readonly canDelete = computed(() => {
    return this.teamService.hasPermission(this.currentProjectId(), 'TODO_DELETE');
  });

  constructor() {
    // Initialisierung: Keinen global aktiven Meilenstein erzwingen
    this.projectService.setActiveMilestoneId(null);

    // Reaktiv auf externe Navigationen (z. B. Klick auf Meilenstein in einem anderen Tab) reagieren
    effect(() => {
      const navState = this.navigationService.currentNavigationState();
      if (navState && navState.type === 'milestone') {
        this.boardFilter.set({
          type: 'milestone',
          id: navState.id
        });
        // Zustand konsumieren und zurücksetzen
        this.navigationService.currentNavigationState.set(null);
      }
    });

    // Reaktiv das aktive Projekt synchronisieren, wenn sich der Filter ändert
    effect(() => {
      const filter = this.boardFilter();
      let projectId = "";

      if (filter.type === 'project') {
        projectId = filter.id ?? "";
      } else if (filter.type === 'milestone') {
        projectId = this.todoQueryService.getProjectIdByMilestoneId(filter.id) ?? "";
      }

      if (projectId && projectId !== this.teamService.currentProjectId()) {
        this.teamService.setCurrentProject(projectId);
      }
      this.currentProjectId.set(projectId);
    });
  }

  ngOnInit(): void {
    // Setzt die Standardkategorie für Filterungen
    this.filterService.setInitialCategory('todos');
  }

  /**
   * Filtert und transformiert alle passenden Todos in darstellbare ViewModels.
   */
  private readonly getTodosForBoard = computed(() => {
    const filter = this.boardFilter();
    const allTeamTodos = this.todoService.teamTodos();

    if (!filter || !filter.id) {
      return [];
    }

    let matchingTodos: Todo[] = [];

    if (filter.type === 'milestone') {
      matchingTodos = allTeamTodos.filter(t => t.milestoneId === filter.id);
    } else if (filter.type === 'project') {
      const projectTodos = this.todoQueryService.getTodosForProject(filter.id);
      
      // Filtert zusätzlich nach dem globalen Suchbegriff des Nutzers
      matchingTodos = projectTodos.filter(t => 
        this.filterWithQuery(this.filterService.searchTerm(), t)
      );
    }

    const canInteract = this.canInteractWithBoard();

    return matchingTodos.map(todo => {
      return new TodoViewModel(
        todo,
        false,       // Beschreibung standardmäßig eingeklappt
        canInteract, // canEdit 
        canInteract  // canDelete
      );
    });
  });

  /** Hilfsmethode zur Freitext-Filterung von Aufgaben */
  private filterWithQuery(query: string, todo: Todo): boolean {
    const trimmedQuery = query.toLowerCase().trim();
    if (!trimmedQuery) {
      return true;
    }

    return (
      todo.task.toLowerCase().includes(trimmedQuery) ||
      (todo.description?.toLowerCase().includes(trimmedQuery) ?? false) ||
      (todo.category?.toLowerCase().includes(trimmedQuery) ?? false)
    );
  }

  // --- Spalten-Selektoren (Reaktiv via Computed Signals) ---

  public readonly backlogTasks = computed(() => {
    return this.getTodosForBoard().filter(t => t.todo.teamStatus === "BACKLOG");
  });

  public readonly openTasks = computed(() => {
    return this.getTodosForBoard().filter(t => t.todo.teamStatus === "OPEN");
  });

  public readonly inProgressTasks = computed(() => {
    return this.getTodosForBoard().filter(t => t.todo.teamStatus === "IN_PROGRESS");
  });

  public readonly reviewTasks = computed(() => {
    return this.getTodosForBoard().filter(t => t.todo.teamStatus === "REVIEW");
  });

  public readonly doneTasks = computed(() => {
    return this.getTodosForBoard().filter(t => t.todo.teamStatus === "DONE");
  });

  /**
   * Handles drag-and-drop operations between the 5 Kanban columns.
   * Enforces transition and assignment business rules.
   */
/**
 * 🔄 DIE ZENTRALE DRAG & DROP STEUERUNG
 * Koordiniert den Drag-Vorgang und delegiert die Workflows an spezialisierte Sub-Methoden.
 */
public onTodoDropped(event: CdkDragDrop<any>): void {
  if (event.previousContainer === event.container) {
    return;
  }

  const movedViewModel = event.previousContainer.data[event.previousIndex] as TodoViewModel;
  if (!movedViewModel) return;

  // 1. Eine saubere Kopie erstellen, um Seiteneffekte zu vermeiden
  const updatedTodo = Todo.fromTodo(movedViewModel.todo);
  const targetColumnId = event.container.id;

  console.log("-----------------------------------------");
  console.log("🏁 Drag & Drop gestartet für Task:", updatedTodo.task);

  // 2. Workflow-Regeln per Switch-Statement auf die Sub-Methoden verteilen
  switch (targetColumnId) {
    case 'column-backlog-list':
      this.handleBacklogWorkflow(updatedTodo);
      break;

    case 'column-open-list':
      this.handleOpenWorkflow(updatedTodo);
      break;

    case 'column-progress-list':
      this.handleInProgressWorkflow(updatedTodo);
      break;

    case 'column-review-list':
      this.handleReviewWorkflow(updatedTodo);
      break;

    case 'column-done-list':
      this.handleDoneWorkflow(movedViewModel);
      break;

    default:
      console.warn(`⚠️ Unbekannte Zielspalte: ${targetColumnId}`);
  }
}

// ==========================================================================
// 🛠️ DIE SPEZIFISCHEN WORKFLOW-HELPER (Die "Gehirnzellen" des Boards)
// ==========================================================================

private handleBacklogWorkflow(todo: Todo): void {
  todo.teamStatus = 'BACKLOG';
  todo.done = false;
  todo.isStarted = false;
  todo.lastDeveloperId = null;
  todo.assignedUserId = null; // 🧼 User radikal entfernen

  this.todoService.updateTodo(todo, true);
}

private handleOpenWorkflow(todo: Todo): void {
  todo.teamStatus = 'OPEN';
  todo.done = false;
  todo.isStarted = false;
  todo.lastDeveloperId = null;
  todo.assignedUserId = null; // 🧼 Auch in Open leeren wir alles für ein freies Ticket

  this.todoService.updateTodo(todo, true);
}

private handleInProgressWorkflow(todo: Todo): void {
  const currentUserId = this.userService.getCurrentUserId() ?? null;
  
  todo.teamStatus = 'IN_PROGRESS';
  todo.done = false;
  todo.isStarted = true;

  // Wenn das Ticket aus dem Review zurückkommt, kriegt es der vorherige Dev, sonst der aktuelle User
  const chosenUserId = todo.lastDeveloperId ?? currentUserId;
  todo.assignedUserId = chosenUserId;

  this.todoService.updateTodo(todo, true);
}

private handleReviewWorkflow(todo: Todo): void {
  todo.teamStatus = 'REVIEW';
  todo.done = false;

  // Entwickler im Gedächtnis sichern (der bisherige Bearbeiter)
  todo.lastDeveloperId = todo.assignedUserId ?? null;
  todo.assignedUserId = null; // 🧼 Zuweisung aufheben, damit andere reviewen können

  this.todoService.updateTodo(todo, true);
}

private handleDoneWorkflow(movedViewModel: TodoViewModel): void {
  movedViewModel.todo.teamStatus = 'DONE';
  movedViewModel.todo.assignedUserId = null; // 🧼 User bei DONE entfernen
  movedViewModel.todo.completedAt = Date.now();

  // Für das Punkte-Popup übergeben wir das bearbeitete Todo
  console.log("🟢 Karte geht Richtung DONE. Triggere Punkte-Popup direkt auf dem ViewModel.");
  
  // 🎪 Wir delegieren das Popup komplett an das ViewModel der Karte!
  // Die Karte bleibt physikalisch in ihrer aktuellen Spalte stehen.
  movedViewModel.onTodoChecked(this.todoService);
}

  /** Bestätigt den tatsächlichen Aufwand im Abschluss-Popup */
  public confirmEffortFromBoard(): void {
    const todo = this.todoWaitingForPopup();
    if (todo) {
      this.todoService.toggleComplete(todo.id, this.popupEffortValue());
    }
    this.showEffortPopup.set(false);
    this.todoWaitingForPopup.set(null);
  }

  /** Ändert den zugewiesenen Nutzer manuell via Dropdown */
  public onAssigneeChange(todo: Todo, event: Event): void {
    const select = event.target as HTMLSelectElement;
    todo.assignedUserId = select.value || null;
    this.todoService.updateTodo(todo, true);
  }

  /** Callback bei der Meilenstein-Auswahl aus dem Welcome-Screen */
  public onMilestoneSelectedFromWelcome(milestoneId: string): void {
    if (milestoneId) {
      this.boardFilter.set({ type: "milestone", id: milestoneId });
    }
  }

  /** Callback bei der Projekt-Auswahl aus dem Welcome-Screen */
  public onProjectSelectedFromWelcome(projectId: string): void {
    if (projectId) {
      this.boardFilter.set({ type: "project", id: projectId });
    }
  }

  /** Prüft, ob das Board interaktiv bedienbar ist (Projekt gewählt & Schreibrechte) */
  public canInteractWithBoard(): boolean {
    if (!this.currentProjectId()) {
      return false;
    }
    return this.teamService.hasPermission(this.currentProjectId(), 'TODO_EDIT');
  }

  // --- Modal Popups ---
  public openPlanningPopup(): void {
    this.showPlanningModal.set(true);
  }

  public closePlanningPopup(): void {
    this.showPlanningModal.set(false);
  }
}