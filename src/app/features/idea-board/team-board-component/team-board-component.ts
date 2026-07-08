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

  private getTodosForBoard = computed(() => {
    const filter = this.boardFilter();
    const rawTodos = filter.type === 'milestone'
      ? this.todoService.getTodosForMilestone(filter.id)
      : this.todoQueryService.getTodosForProject(filter.id).filter(t => this.filterWithQuery(this.filterService.searchTerm(), t));
    return rawTodos;
  })

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
      .filter(t => t.teamStatus === "BACKLOG")
      .map(t => new TodoViewModel(t, false, this.canEdit(), this.canDelete()));
  });

  // ⚪ 2. OPEN Spalte (Deine "alte" Offen-Spalte)
  public openTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.teamStatus === "OPEN")
      .map(t => new TodoViewModel(t, false, this.canEdit(), this.canDelete()));
  });

  // 🟡 3. IN PROGRESS Spalte
  public inProgressTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.teamStatus === "IN_PROGRESS")
      .map(t => new TodoViewModel(t, false, this.canEdit(), this.canDelete()));
  });

  // 👁️ 4. REVIEW Spalte
  public reviewTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.teamStatus === "REVIEW")
      .map(t => new TodoViewModel(t, false, this.canEdit(), this.canDelete()));
  });

  // 🟢 5. DONE Spalte
  public doneTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.teamStatus === "DONE")
      .map(t => new TodoViewModel(t, false, this.canEdit(), this.canDelete()));
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

    const targetColumnId = event.container.id;
    console.log("🏁 Zielspalten-ID erkannt:", targetColumnId);

    // 📦 REGELEFFEKT 1: Zurück ins BACKLOG gezogen
    if (targetColumnId === 'column-backlog-list') {
      movedViewModel.todo.teamStatus = 'BACKLOG';
      movedViewModel.todo.done = false;
      movedViewModel.todo.isStarted = false;
      movedViewModel.todo.assignedUserId = null; // 🧼 User radikal entfernen!

      this.todoService.updateTodo(movedViewModel.todo, true);
    }

    // ⚪ REGELEFFEKT 2: Nach OPEN gezogen
    else if (targetColumnId === 'column-open-list') {
      movedViewModel.todo.teamStatus = 'OPEN';
      movedViewModel.todo.done = false;
      movedViewModel.todo.isStarted = false;
      // Hier lassen wir den User unberührt (falls mal einer eingetragen war), erzwungen wird er aber nicht.

      this.todoService.updateTodo(movedViewModel.todo, true);
    }

    // 🟡 REGELEFFEKT 3: Nach IN PROGRESS gezogen (Hier muss ein User drauf sitzen!)
    else if (targetColumnId === 'column-progress-list') {
      movedViewModel.todo.teamStatus = 'IN_PROGRESS';
      movedViewModel.todo.done = false;
      movedViewModel.todo.isStarted = true;

      if (!movedViewModel.todo.assignedUserId) {
        console.log("👥 Kein Mitarbeiter im In-Progress-Zustand! Zeige Zuweisungs-Popup.");
        movedViewModel.showAssigneePopup.set(true);
        return;
      } else {
        this.todoService.updateTodo(movedViewModel.todo, true);
      }
    }

    // 👁️ REGELEFFEKT 4: Nach REVIEW gezogen (Kontroll-Modus)
    else if (targetColumnId === 'column-review-list') {
      movedViewModel.todo.teamStatus = 'REVIEW';
      movedViewModel.todo.done = false;

      if (!movedViewModel.todo.assignedUserId) {
        console.log("👥 Für ein Review wird ebenfalls ein fester Bearbeiter erzwungen!");
        movedViewModel.showAssigneePopup.set(true);
        return;
      } else {
        this.todoService.updateTodo(movedViewModel.todo, true);
      }
    }

    // 🟢 REGELEFFEKT 5: Nach DONE gezogen (Erledigt & User saubermachen!)
    else if (targetColumnId === 'column-done-list') {
      movedViewModel.todo.teamStatus = 'DONE';
      movedViewModel.todo.assignedUserId = null; // 🧼 Genialer Einfall von dir: User bei DONE entfernen!

      console.log("🟢 Karte geht nach DONE. Schnappt zurück fürs Aufwands-Punkte-Popup.");
      movedViewModel.onTodoChecked(this.todoService);
      return;
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
