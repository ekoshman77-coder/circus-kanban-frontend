import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop'; // 🟢 NEU: DragDrop importiert
import { TodoService } from '../../../core/services/todo/todo-service';
import { Todo } from '../../../core/models/todo';
import { UserService } from '../../../core/services/user/user-service';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { PlannerRecommendationComponent } from '../planner-recommendation-component/planner-recommendation-component';
import { PlannerSettingsComponent } from '../planner-settings-component/planner-settings-component';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';

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
  private userService = inject(UserService);
  private plannerService = inject(PlannerService);
  

  showAiRecommendation = signal<boolean>(false);
  recommendedTodo = signal<Todo | null>(null);
  showSettings = signal<boolean>(false);
  
  collapsedQuadrants = signal<Record<string, boolean>>({
    doFirst: true,
    schedule: true,
    delegate: true,
    eliminate: true,
    restZone: true
  });

  readonly userEnergy = this.userService.userEnergy;
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
    this.recommendedTodo.set(droppedTodo);
  }
}

  handleRecommendationResult(result: { accepted: boolean; todoId: string }) {
    if (result.accepted) {
      const allTodos = this.openTodos();
      const found = allTodos.find(t => t.id === result.todoId);
      if (found) {
        this.recommendedTodo.set(found);
      }
      this.showAiRecommendation.set(false);
    } else {
      this.showAiRecommendation.set(false);
    }
  }
}