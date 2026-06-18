import { Component, inject, computed, input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service';
import { TeamService } from '../../../core/services/team-service';
import { Todo } from '../../../core/models/todo';
import { TabNavigationService } from '../tab-navigation-service';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
// 🚀 HIER IST ER WIEDER DA: Der korrekte Import aus dem Angular CDK!
import { CdkDragDrop, DragDropModule, transferArrayItem } from '@angular/cdk/drag-drop';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { ProjectService } from '../../../core/services/project-service';
import { IdeaSortingService } from '../../../core/services/board-state-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { UserModel } from '../../../core/models/user-model';
import { map, of, switchMap } from 'rxjs';

export type BoardFilterState = {
  type: 'project' | 'milestone' | null;
  id: string | null;
};

@Component({
  selector: 'app-team-board',
  standalone: true,
  imports: [CommonModule, FormsModule, TodoItemComponent, DragDropModule, MilestoneSelectorComponent],
  templateUrl: './team-board-component.html',
  styleUrl: './team-board-component.css'
})
export class TeamBoardComponent {
  public todoService = inject(TodoService);
  public teamService = inject(TeamService);
  public navigationService = inject(TabNavigationService);
  private projectService = inject(ProjectService)

  // 🏁 Die stabilen Steuerungssignale direkt auf dem Board:
  public showAssigneePopup = signal<boolean>(false);
  public showEffortPopup = signal<boolean>(false);
  public todoWaitingForPopup = signal<Todo | null>(null);
  public popupEffortValue = signal<number>(0);

  public boardFilter = signal<BoardFilterState>({ type: null, id: null })

  constructor() {
    const projectService = inject(ProjectService);
    const tabNavigationService = inject(TabNavigationService);
    
    // 🎯 Gestern-Fix: Meilenstein-Tab-Leuchten zurücksetzen
    projectService.setActiveMilestoneId(null);

    // 🚀 STABILER REAKTIVER EFFECT FÜR UNSERE WEITERLEITUNG:
    effect(() => {
      // Wir abonnieren das Signal! Sobald die Daten da sind, springt der Effekt an.
      const navState = tabNavigationService.currentNavigationState();
      
      if (navState && navState.type === 'milestone') {
        console.log('📥 REAKTIV EMPFANGEN: Filter wird gesetzt auf Meilenstein:', navState.id);
        
        // Lokalen Filter setzen
        this.boardFilter.set({
          type: 'milestone',
          id: navState.id
        });
        
        // State im Service wieder leeren (untracked verhindert Endlosschleifen)
        // Angular erlaubt es, Signals in Effekten zu schreiben, solange es sauber terminiert.
        tabNavigationService.currentNavigationState.set(null);
      }
    });
  }
  
  public currentProjectId = computed(() => {
    const filter = this.boardFilter();
    if (!filter.type || !filter.id) return null;
    if (filter.type === 'project') return filter.id;

    const allProjects = this.projectService.projectsList();
    const matchingProject = allProjects.find(p => p.milestones?.some(m => m.id === filter.id));
    return matchingProject ? matchingProject.id : null;
  });

  // B) Die Pipeline, die das Observable automatisch auflöst!
  public currentProjectMembers = toSignal(
    toObservable(this.currentProjectId).pipe(
      switchMap(projectId => {
        if (!projectId) return of([]); // Wenn keine ID da ist, schicke leeres Array
        return this.teamService.getSortedMembers$(projectId); // Ruft das Observable ab!
      })
    ),
    { initialValue: [] } // WICHTIG: Damit ist es NIEMALS undefined, sondern startet als leeres Array!
  );

  private getTodosForBoard(): Todo[] {
    const filter = this.boardFilter();
    const rawTodos = filter.type === 'milestone'
      ? this.todoService.getTodosForMilestone(filter.id)
      : this.projectService.getProjectTodos(filter.id);
    return rawTodos;
  }

  // Reaktive Filterung der Tasks für die Spalten
  // ⚪ Offene Spalte
  public openTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.teamStatus === "Offen")
      .map(t => new TodoViewModel(t, false));
  });

  // 🟡 In Arbeit Spalte
  public inProgressTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.teamStatus === "In Arbeit")
      .map(t => new TodoViewModel(t, false));
  });

  // 🟢 Erledigt Spalte
  public doneTasks = computed(() => {
    return this.getTodosForBoard()
      .filter(t => t.teamStatus === "Erledigt")
      .map(t => new TodoViewModel(t, false));
  });

  /**
   * Die zentrale Drag & Drop Steuerung
   */
  public onTodoDropped(event: CdkDragDrop<any>): void {
    console.log("=== DRAG & DROP EVENT FÜR DIE KONSOLE ===");
    console.log("Von Container:", event.previousContainer.id);
    console.log("Nach Container:", event.container.id);

    if (event.previousContainer === event.container) {
      return;
    }

    // Das originale Live-ViewModel aus dem Quell-Container auslesen
    const movedViewModel = event.previousContainer.data[event.previousIndex] as TodoViewModel;
    if (!movedViewModel) return;

    console.log("📝 Aufgabe:", movedViewModel.todo.task);
    console.log("👤 assignedMemberId auf .todo:", movedViewModel.todo.assignedUserId);
    console.log("⚙️ showAssigneePopup Wert VOR der Weiche:", movedViewModel.showAssigneePopup());
    console.log("🏁 Zielspalten-ID:", event.container.id);
    const targetColumnId = event.container.id;

    // ⚪ NACH LINKS: Offen
    if (targetColumnId === 'column-open-list') {
      movedViewModel.todo.done = false;
      movedViewModel.todo.isStarted = false;

      // Die Karte schnappt visuell zurück, aber das Backend speichert es im Hintergrund.
      // Sobald Docker antwortet, wandert die Karte reaktiv nach links!
      this.todoService.updateTodo(movedViewModel.todo, true);
    }

    // 🟡 IN DIE MITTE: In Arbeit
    else if (targetColumnId === 'column-progress-list') {
      movedViewModel.todo.done = false;
      movedViewModel.todo.isStarted = true;

      // Mitarbeiter-Prüfung auf dem echten Objekt
      if (!movedViewModel.todo.assignedUserId) {
        console.log("👥 Kein Mitarbeiter! Öffne Zuweisungs-Popup.");

        // Das lokale Signal im ViewModel aktivieren (jetzt wo dein HTML repariert ist!)
        movedViewModel.showAssigneePopup.set(true);
        return;
      } else {
        // Mitarbeiter ist da -> Karte schnappt zurück, speichert, und fliegt via Docker reaktiv in die Mitte!
        this.todoService.updateTodo(movedViewModel.todo, true);
      }
    }

    // 🟢 NACH RECHTS: Erledigt
    else if (targetColumnId === 'column-done-list') {
      console.log("🟢 Karte will nach Erledigt. Schnappt zurück für Punkte-Popup!");
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

  // Hilfsmethode für den alten Template-Rest unten im HTML
  // public getAssignedMember(memberId: string | null) {
  //   if (!memberId) return null;
  //   const members = toSignal( this.teamService.getSortedByLastName$)
  //   return this.teamService.getSortedByLastName$.find(m => m.id === memberId);
  // }

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
}