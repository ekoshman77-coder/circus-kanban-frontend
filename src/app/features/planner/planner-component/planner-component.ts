import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop'; // 🟢 NEU: DragDrop importiert
import { TodoService } from '../../../core/services/todo/todo-service';
import { Todo } from '../../../core/models/todo';
import { UserService } from '../../../core/services/user/user-service';
import { PlannerService, RecommendedTodoItem } from '../../../core/services/ai/planner-service';
import { PlannerSettingsComponent } from '../planner-settings-component/planner-settings-component';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { UserSettingsService } from '../../../core/services/user/user-settings-service';
import { PlannerRecommendationComponent } from '../planner-recommendation-component/planner-recommendation-component';

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule, // 🟢 NEU: Hier registriert
    PlannerRecommendationComponent,
    PlannerSettingsComponent,
    TodoItemComponent
  ],
  templateUrl: './planner-component.html',
  styleUrls: ['./planner-component.css']
})
export class PlannerComponent {
  private todoService = inject(TodoService);
  private userSettingsService = inject(UserSettingsService);
  private plannerService = inject(PlannerService);

  showAiRecommendation = signal<boolean>(false);
  recommendedTodos = signal<RecommendedTodoItem[]>([]);
  activeRoundId = signal<string>(''); // Falls die Komponente die roundId für die Kindkomponente braucht

  activeFocusTodo = signal<Todo | null>(null);
  showSettings = signal<boolean>(false);

  collapsedQuadrants = signal<Record<string, boolean>>({
    doFirst: true,
    schedule: true,
    delegate: true,
    eliminate: true,
    restZone: true
  });

  readonly userEnergy = this.userSettingsService.userEnergy;
  readonly worlkingTimeLeft = this.userSettingsService.workingTimeLeft; 
  private openTodos = this.todoService.openTodosOnly;

  private isUrgent(todo: Todo): boolean {
    if (!todo.dueDate) return false;
    const fortyEightHoursInMs = 48 * 60 * 60 * 1000;
    return (todo.dueDate - Date.now()) <= fortyEightHoursInMs;
  }

  // 🌴 Die Oase: Sammelt alle To-Dos ohne Punkte (Aufwand === 0)
  quadrantRestZone = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) === 0)
      .map(t => new TodoViewModel(t, false, true, true))
  );

  // 🔥 Quadrant 1: Dringend & Leicht (Aufwand 1-3)
  quadrantDoFirst = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) > 0 && (t.effort || 0) <= 3 && this.isUrgent(t))
      .map(t => new TodoViewModel(t, false, true, true))
  );

  // 📅 Quadrant 2: Dringend & Aufwendig (Aufwand > 3)
  quadrantSchedule = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) > 3 && this.isUrgent(t))
      .map(t => new TodoViewModel(t, false, true, true))
  );

  // ⚡ Quadrant 3: Nicht dringend & Leicht (Aufwand 1-3)
  quadrantDelegate = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) > 0 && (t.effort || 0) <= 3 && !this.isUrgent(t))
      .map(t => new TodoViewModel(t, false, true, true))
  );

  // ⏳ Quadrant 4: Nicht dringend & Aufwendig (Aufwand > 3)
  quadrantEliminate = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) > 3 && !this.isUrgent(t))
      .map(t => new TodoViewModel(t, false, true, true))
  );

  calculateRecommendation() {
    this.showAiRecommendation.set(true);
  }

  toggleQuadrant(name: string): void {
    this.collapsedQuadrants.update(states => ({
      ...states,
      [name]: !states[name]
    }));
  }

  // 🟢 NEU: Fängt das Ticket ab, wenn es auf den Banner gezogen wird!
  onTodoDropped(event: CdkDragDrop<any>) {
    // Das gezogene To-Do-Objekt aus den Drag-Daten herausholen
    const droppedTodo: Todo = event.item.data;
    if (droppedTodo) {
      console.log(`🎯 Manueller Fokus-Drop: "${droppedTodo.task}" erfolgreich gesetzt!`);
      this.activeFocusTodo.set(droppedTodo);
    }
  }

// Wird aufgerufen, wenn in der Recommendation-Komponente eine Karte "Angepackt" wird
  handleTodoSelected(selectedItem: RecommendedTodoItem) {
    // 1. Als aktives Fokus-Todo auf der Seite setzen
    this.activeFocusTodo.set(selectedItem.todo);

    // 2. Empfehlungs-Panel sofort schließen und lokale Liste leeren
    this.showAiRecommendation.set(false);
    this.recommendedTodos.set([]);
    this.activeRoundId.set('');
  }

  completeFocusTodo() {
    console.log("completedFocusTodo");
    this.recommendedTodos.set([]);
    this.activeRoundId.set('');
    this.activeFocusTodo.set(null);
  }

  handleSessionCompleted(selectedTodoId: string | null) {
    // 2. Falls ein Todo gewählt wurde, als Fokus setzen
    
    if (selectedTodoId) {
      const todo = this.todoService.getTodoById(selectedTodoId) ?? null;
      this.activeFocusTodo.set(todo);
    }

    // 3. Panel zu machen
    this.showAiRecommendation.set(false);
  }

openRecommendationPanel() {
    this.showAiRecommendation.set(true);

    this.plannerService.loadSmartRecommendation(
      this.userEnergy(), 
      this.worlkingTimeLeft()
    ).subscribe({
      next: (vm) => {
        if (vm) {
          // Die fertig gemappten Items und die RoundId direkt aus dem ViewModel übernehmen
          this.recommendedTodos.set(vm.recommendations);
          this.activeRoundId.set(vm.roundId);
        }
      },
      error: (err) => {
        console.error('Fehler beim Laden der Smart Recommendations:', err);
        this.showAiRecommendation.set(false);
      }
    });
  }
}