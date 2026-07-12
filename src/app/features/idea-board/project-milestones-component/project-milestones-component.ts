import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
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
import { FilterService } from '../../../core/services/filter-service';
import { TeamService } from '../../../core/services/team-service';
import { TodoQueryService } from '../../../core/services/todo-query-service';
import { TodoPlanningModalComponent } from '../../../core/shared/components/todo-planning-modal-component/todo-planning-modal-component';

@Component({
  selector: 'app-project-milestones-component',
  standalone: true,
  imports: [
    CommonModule, 
    MilestoneSelectorComponent, 
    TodoFormComponent, 
    DragDropModule, 
    TodoItemComponent,
    TodoPlanningModalComponent
  ],
  templateUrl: './project-milestones-component.html',
  styleUrl: './project-milestones-component.css',
})
export class ProjectMilestonesComponent implements OnInit {
  private projectService = inject(ProjectService);
  private tabService = inject(TabNavigationService);
  private todoService = inject(TodoService);
  private filterService = inject(FilterService);
  private teamService = inject(TeamService)
  private todoQueryService = inject(TodoQueryService)

  // 🎯 UNSER SAUBERER BOARDFILTER
  public boardFilter = signal<{ projectId: string; milestoneId: string } | null>(null);
  public showCreateModal = signal<boolean>(false)
  
  constructor() {
    effect(() => {
      const navState = this.tabService.currentNavigationState();
      if (!navState) return;

      if (this.projectService.projectsList().length === 0) return;
      // Falls die Projektdaten noch nicht geladen sind, warten wir reaktiv auf den nächsten Cycle!
      let success = false;

      // Fall A: Es kommt direkt eine Meilenstein-ID
      if (navState.type === 'milestone') {
        console.log('📥 [Milestones] Reaktiv Meilenstein empfangen! ID:', navState.id);
        success = this.setFilterByMilestoneId(navState.id);
      } 
      // Fall B: Es kommt eine Projekt-ID -> 1. Meilenstein aktivieren
      else if (navState.type === 'project') {
        console.log('📥 [Milestones] Reaktiv Projekt empfangen! ID:', navState.id);
        success = this.setFilterByProject(navState.id);
      }

      // WICHTIG: Nur löschen, wenn wir die Zuordnung erfolgreich verarbeitet haben!
      if (success) {
        console.log('📥 [Milestones] set navigation state to null');
        this.tabService.currentNavigationState.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.filterService.setInitialCategory('milestones')
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
          console.log('📥 [Milestones] filter gesetzt', this.boardFilter());
          this.teamService.setCurrentProject(projectId)
          return true;
        }
        return false
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
      this.teamService.setCurrentProject(foundProject.id)
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

public assignedTodos = computed(() => {
    const match = this.currentMatch();
    if (!match || !match.milestoneTodos) return [];

    const now = new Date().getTime();

    // Wir kopieren das Array (.slice()), um das originale Signal nicht direkt zu mutieren
    return match.milestoneTodos.slice().sort((a, b) => {
      // 🥇 SCHRITT 1: Erledigte Tickets nach ganz unten filtern
      // (a.checked ? 1 : 0) konvertiert false zu 0 und true zu 1
      const checkedDiff = (a.todo.done ? 1 : 0) - (b.done ? 1 : 0);
      if (checkedDiff !== 0) return checkedDiff; // Wenn eins erledigt ist und das andere nicht, wandert das erledigte nach unten.

      // 🥈 SCHRITT 2: Wenn beide offen (oder beide erledigt) sind, greift die Risiko-Formel
      // Pufferzeit in Tagen berechnen. Falls kein Datum gesetzt ist, gilt es als unkritisch (100 Tage).
      const daysLeftA = a.todo.dueDate ? (a.todo.dueDate - now) / (1000 * 60 * 60 * 24) : 100;
      const daysLeftB = b.todo.dueDate ? (b.todo.dueDate - now) / (1000 * 60 * 60 * 24) : 100;

      // Aufwand holen (Story Points). Wenn ungeschätzt, gilt 1 SP als Standard.
      const effortA = a.effort || 1;
      const effortB = b.effort || 1;

      // Risiko-Score: Je kleiner/negativer, desto dringender (Resttage minus Aufwandstage)
      const riskScoreA = daysLeftA - effortA;
      const riskScoreB = daysLeftB - effortB;

      return riskScoreA - riskScoreB;
    });
  });

  // public unassignedTodos = computed(() => {
  //   return this.todoService
  //     .allTodos()
  //     .filter((t) => t.milestoneId === null)
  //     .map((t) => new TodoViewModel(t, false));
  // });

  public unassignedTodos = computed(() => {
    const freeTodos = this.todoService.allTodos()
      .filter((t) => t.milestoneId === null)
      .map((t) => new TodoViewModel(t, false));
    if (!freeTodos) return [];

    return freeTodos.slice().sort((a, b) => {
      // 🥇 SCHRITT 1: Erledigte Tickets nach ganz unten filtern
      const checkedDiff = (a.todo.done ? 1 : 0) - (b.todo.done ? 1 : 0);
      if (checkedDiff !== 0) return checkedDiff;

      // 🥈 SCHRITT 2: Wenn beide offen (oder beide erledigt) sind, gilt LIFO (Neueste ganz oben)
      const timeA = a.todo.createdAt ? new Date(a.todo.createdAt).getTime() : 0;
      const timeB = b.todo.createdAt ? new Date(b.todo.createdAt).getTime() : 0;

      return timeB - timeA; // Höchster Zeitstempel (Neueste) zuerst
    });
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

  // 4. 🔒 UNSERE ZENTRALE RECHTE-METHODE FÜR DIESE SEITE:
  public canInteractWithTodos(): boolean {
    const allProjects = this.projectService.projectsList();
    const foundProject = allProjects.find((p) => 
      p.milestones.some((m) => m.id === this.activeMilestoneId())
    );
    if (!foundProject) {
      return false
    }
    const hasPermission = this.teamService.hasPermission(foundProject!.id, 'MILESTONE_EDIT')
    console.log("canInteractWithTodos :: permission result ", hasPermission)
    return hasPermission; 
  }

  public openModalForm(): void {
    if (this.canInteractWithTodos()) {
      console.log('✨ [Modal] Öffne Formular für neue Aufgabe...');
      this.showCreateModal.set(true);
    }
  }

  // 🔒 Schließt das Formular-Modal wieder safely
  public closeModalForm(): void {
    console.log('🧼 [Modal] Schließe Formular.');
    this.showCreateModal.set(false);
  }
}