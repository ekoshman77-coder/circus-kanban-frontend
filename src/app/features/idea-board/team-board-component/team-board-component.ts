import { Component, inject, computed, input, signal, effect, OnInit, Signal } from '@angular/core';
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

export type BoardFilterState = {
  type: 'project' | 'milestone' | null;
  id: string | null;
};

@Component({
  selector: 'app-team-board',
  standalone: true,
  imports: [CommonModule, FormsModule, TodoItemComponent, DragDropModule, MilestoneSelectorComponent, TodoPlanningModalComponent],
  templateUrl: './team-board-component.html',
  styleUrl: './team-board-component.css'
})
export class TeamBoardComponent implements OnInit {
  public todoService = inject(TodoService);
  public teamService = inject(TeamService);
  public navigationService = inject(TabNavigationService);
  private projectService = inject(ProjectService)
  private filterService = inject(FilterService)
  private todoQueryService = inject(TodoQueryService)
  private userService = inject(UserService)


  // 🏁 Die stabilen Steuerungssignale direkt auf dem Board:
  public showAssigneePopup = signal<boolean>(false);
  public showEffortPopup = signal<boolean>(false);
  public todoWaitingForPopup = signal<Todo | null>(null);
  public popupEffortValue = signal<number>(0);
  showPlanningModal = signal<boolean>(false);

  public boardFilter = signal<BoardFilterState>({ type: null, id: null })

  public canEdit = computed(() => {
    return this.teamService.hasPermission(this.currentProjectId(), 'TODO_EDIT')
  })
  public canDelete = computed(() => {
    return this.teamService.hasPermission(this.currentProjectId(), 'TODO_DELETE')
  })

  private currentProjectId = signal<string>("")
  public currentMilestioneId = computed(() => {
    return (this.boardFilter().type === 'milestone') ? this.boardFilter().id : "" 
  })
  
  public currentProjectMembers = this.teamService.currentProjectMembersSignal;

  public assignableUsers = computed(() => {
    console.log("nimmt assignalbe user aus members", this.currentProjectMembers())
    return this.currentProjectMembers().map(member => member.user);
  });

  constructor() {
    this.projectService.setActiveMilestoneId(null);

    effect(() => {
      const navState = this.navigationService.currentNavigationState();

      if (navState && navState.type === 'milestone') {
        console.log('REAKTIV EMPFANGEN: Filter wird gesetzt auf Meilenstein:', navState.id);

        // Lokalen Filter setzen
        this.boardFilter.set({
          type: 'milestone',
          id: navState.id
        });
        
        this.navigationService.currentNavigationState.set(null);
      }
    });

    effect(() => {
      const filter = this.boardFilter();
      let projectId: string = "";

      if (filter.type === 'project') {
        projectId = filter.id ?? "";
      } else if (filter.type === 'milestone') {
        projectId = this.todoQueryService.getProjectIdByMilestoneId(filter.id) ?? "";
      }
      if (projectId && projectId !== this.teamService.currentProjectId()) {
        console.log(`📡 Board wechselt Projekt von ${this.teamService.currentProjectId()} zu ${projectId}. Starte Sync.`);
        this.teamService.setCurrentProject(projectId);
      }
      this.currentProjectId.set(projectId)
    });
  }

  ngOnInit(): void {
    this.filterService.setInitialCategory('todos')
  }

// 🌟 UNSER REAKTIVER SUPER-FILTER: Perfekt abgestimmt auf dein Datenmodell!
  private getTodosForBoard = computed(() => {
    const filter = this.boardFilter(); // { type: 'project'|'milestone'|null, id: string|null }
    const allTeamTodos = this.todoService.teamTodos(); // 🎪 Hält die Reaktivität für Team-Aufgaben aufrecht

    if (!filter || !filter.id) {
      return [];
    }

    // Hilfsvariable für die passenden rohen Todos
    let matchingTodos: Todo[] = [];

    if (filter.type === 'milestone') {
      // 🏁 Fall A: Filter für Meilenstein
      // Nur Todos aus den Team-Aufgaben, die direkt zu diesem Meilenstein gehören
      matchingTodos = allTeamTodos.filter(t => t.milestoneId === filter.id);
    } else if (filter.type === 'project') {
      // 📁 Fall B: Filter für das gesamte Projekt
      // 🚀 HIER SPELEN WIR UNSERE TRUMPFKARTE AUS: Die Supermethode aus dem TodoQueryService!
      const projectTodos = this.todoQueryService.getTodosForProject(filter.id);
      
      // Und wir filtern direkt noch nach dem Suchbegriff des Nutzers
      matchingTodos = projectTodos.filter(t => 
        this.filterWithQuery(this.filterService.searchTerm(), t)
      );
    }

    // 🛠️ Jetzt wandeln wir die rohen Todos sauber in TodoViewModels um
    const canInteract = this.canInteractWithBoard();

    return matchingTodos.map(todo => {
      return new TodoViewModel(
        todo,
        false,        // isDescriptionOpen standardmäßig geschlossen
        canInteract,  // canEdit 
        canInteract   // canDelete
      );
    });
  });

  private filterWithQuery(query: string, todo: Todo): boolean {
    const trimmedQuery = query.toLowerCase().trim()
    if (!trimmedQuery) {
      return true
    }

    return (todo.task.toLowerCase().includes(trimmedQuery)
      || (todo.description?.toLowerCase().includes(trimmedQuery) ?? false)
      || (todo.category?.toLowerCase().includes(trimmedQuery) ?? false))
  }

  public backlogTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.todo.teamStatus === "BACKLOG")
  });

  // ⚪ 2. OPEN Spalte (Deine "alte" Offen-Spalte)
  public openTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.todo.teamStatus === "OPEN")
  });

  // 🟡 3. IN PROGRESS Spalte
  public inProgressTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.todo.teamStatus === "IN_PROGRESS")
  });

  // 👁️ 4. REVIEW Spalte
  public reviewTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.todo.teamStatus === "REVIEW")
  });

  // 🟢 5. DONE Spalte
  public doneTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.todo.teamStatus === "DONE")
  });

  /**
   * 🔄 DIE ZENTRALE DRAG & DROP STEUERUNG (MIT DEINEN WORKFLOW-REGELN)
   */
public onTodoDropped(event: CdkDragDrop<any>): void {
    if (event.previousContainer === event.container) {
      return;
    }

    const movedViewModel = event.previousContainer.data[event.previousIndex] as TodoViewModel;
    if (!movedViewModel) return;

    // 1. 👥 Aktuelle User-ID holen
    const currentUserId = this.userService.getCurrentUserId() ?? null;

    // 2. 🎪 EINE SAUBERE KOPIE ERSTELLEN (Keine direkte Mutation des Originals!)
    const updatedTodo = Todo.fromTodo(movedViewModel.todo);
    const targetColumnId = event.container.id;

    console.log("-----------------------------------------");
    console.log("🏁 Drag & Drop gestartet für Task:", updatedTodo.task);

    // 3. ⚡ DIE WORKFLOW-REGELN AUF DER KOPIE ANWENDEN
    
    // 📦 REGELEFFEKT 1: Zurück ins BACKLOG gezogen
    if (targetColumnId === 'column-backlog-list') {
      updatedTodo.teamStatus = 'BACKLOG';
      updatedTodo.done = false;
      updatedTodo.isStarted = false;
      updatedTodo.lastDeveloperId = null;
      updatedTodo.assignedUserId = null; // 🧼 User radikal entfernen

      this.todoService.updateTodo(updatedTodo, true);
    }

    // ⚪ REGELEFFEKT 2: Nach OPEN gezogen
    else if (targetColumnId === 'column-open-list') {
      updatedTodo.teamStatus = 'OPEN';
      updatedTodo.done = false;
      updatedTodo.isStarted = false;
      updatedTodo.lastDeveloperId = null;
      updatedTodo.assignedUserId = null; // 🧼 Auch in Open leeren wir alles für ein freies Ticket
      
      this.todoService.updateTodo(updatedTodo, true);
    }

    // 🟡 REGELEFFEKT 3: Nach IN PROGRESS gezogen
    else if (targetColumnId === 'column-progress-list') {
      updatedTodo.teamStatus = 'IN_PROGRESS';
      updatedTodo.done = false;
      updatedTodo.isStarted = true;

      // Wenn das Ticket aus dem Review zurückkommt, kriegt es der vorherige Dev, sonst der aktuelle User
      const chosenUserId = updatedTodo.lastDeveloperId ?? currentUserId;
      updatedTodo.assignedUserId = chosenUserId;
      
      this.todoService.updateTodo(updatedTodo, true);
    }

    // 👁️ REGELEFFEKT 4: Nach REVIEW gezogen
    else if (targetColumnId === 'column-review-list') {
      updatedTodo.teamStatus = 'REVIEW';
      updatedTodo.done = false;
      
      // Entwickler im Gedächtnis sichern (der bisherige Bearbeiter)
      updatedTodo.lastDeveloperId = updatedTodo.assignedUserId ?? null;
      updatedTodo.assignedUserId = null; // 🧼 Zuweisung aufheben, damit andere reviewen können
      
      this.todoService.updateTodo(updatedTodo, true);
    }

    // 🟢 REGELEFFEKT 5: Nach DONE gezogen
    else if (targetColumnId === 'column-done-list') {
      updatedTodo.teamStatus = 'DONE';
      updatedTodo.assignedUserId = null; // 🧼 User bei DONE entfernen
      // lastDeveloperId bleibt unberührt im Gedächtnis!

      // Auf der Kopie die done-Methode triggern (oder wie in deinem ViewModel definiert)
      updatedTodo.done = true;
      updatedTodo.completedAt = Date.now();

      console.log("🟢 Karte geht nach DONE. Öffne Punkte-Popup.");
      
      // Für das Punkte-Popup übergeben wir die Kopie
      this.todoWaitingForPopup.set(updatedTodo);
      this.popupEffortValue.set(updatedTodo.usedEffort > 0 ? updatedTodo.usedEffort : updatedTodo.effort);
      this.showEffortPopup.set(true);
    }
  }
    
  private printUser(userId: string | null | undefined, message: string): void {
    if (!userId) {
      console.log(`👤 [User-Check] ${message}: KEINE ID (null/undefined)`);
      return;
    }
    const member = this.currentProjectMembers().find(m => m.user.id === userId);
    if (member) {
      console.log(`👤 [User-Check] ${message}: ${member.user.firstName} ${member.user.lastName} (ID: ${userId})`);
    } else {
      console.log(`👤 [User-Check] ${message}: Unbekannter User (ID: ${userId})`);
    }
  }

  // Klick-Aktion für das Mitarbeiter-Popup
  public selectAssigneeFromPopup(memberId: string): void {
    const todo = this.todoWaitingForPopup();
    if (todo) {
      todo.assignedUserId = memberId;
      this.todoService.updateTodo(todo, true);
    }
    this.showAssigneePopup.set(false);
    this.todoWaitingForPopup.set(null);
  }

  // Klick-Aktion für das Punkte-Popup
  public confirmEffortFromBoard(): void {
    const todo = this.todoWaitingForPopup();
    if (todo) {
      this.todoService.toggleComplete(todo.id, this.popupEffortValue());
    }
    this.showEffortPopup.set(false);
    this.todoWaitingForPopup.set(null);
  }

  public onAssigneeChange(todo: Todo, event: Event): void {
    const select = event.target as HTMLSelectElement;
    todo.assignedUserId = select.value || null;
    this.todoService.updateTodo(todo, true);
  }

  public onMilestoneSelectedFromWelcome(milestoneId: string): void {
    if (milestoneId) {
      // Wir sagen dem Navigationsdienst: "Setze den Zustand auf diesen Meilenstein!"
      this.boardFilter.set({
        type: "milestone",
        id: milestoneId
      })
    }
  }

  public onProjectSelectedFromWelcome(projectId: string): void {
    if (projectId) {
      // Wir sagen dem Navigationsdienst: "Setze den Zustand auf diesen Meilenstein!"
      this.boardFilter.set({
        type: "project",
        id: projectId
      })
    }
  }

  public canInteractWithBoard(): boolean {
    if (!this.currentProjectId()) {
      return false;
    }
    const hasPermission = this.teamService.hasPermission(this.currentProjectId(), 'TODO_EDIT')
    return hasPermission;
  }

  public openPlanningPopup() {
    console.log("openPlanningPopup")
    this.showPlanningModal.set(true)
  }

  public closePlanningPopup() {
    console.log("closePlanningPopup")
    this.showPlanningModal.set(false)   
  }
}
