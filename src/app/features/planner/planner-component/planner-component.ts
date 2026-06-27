import { Component, computed, inject, NgModule, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service';
import { Todo } from '../../../core/models/todo';
import { UserService } from '../../../core/services/user/user-service';
import { PlannerService } from '../../../core/services/planner-service';
import { PlannerRecommendationComponent } from '../planner-recommendation-component/planner-recommendation-component';

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [CommonModule, PlannerRecommendationComponent],
  templateUrl: './planner-component.html',
  styleUrls: ['./planner-component.css']
})
export class PlannerComponent {
  private todoService = inject(TodoService);
  private userService = inject(UserService);
  private plannerService = inject(PlannerService)

  showAiRecommendation = signal<boolean>(false); // ⚡ NEU: Standardmäßig versteckt!

  recommendedTodo = signal<Todo | null>(null);
  readonly userEnergy = this.userService.userEnergy;

  private openTodos = this.todoService.openTodosOnly;

  private isUrgent(todo: Todo): boolean {
    if (!todo.dueDate) return false;
    const fortyEightHoursInMs = 48 * 60 * 60 * 1000;
    return (todo.dueDate - Date.now()) <= fortyEightHoursInMs;
  }

  // 🌴 Die Oase: Sammelt alle To-Dos ohne Punkte (Aufwand === 0)
  quadrantRestZone = computed(() =>
    this.openTodos().filter(t => t.effort === 0)
  );

  // 🔥 Quadrant 1: Dringend & Leicht (Nur echte Aufgaben mit Punkten > 0)
  quadrantDoFirst = computed(() => {
    console.log("Plannercomponent: openTodos ", this.openTodos())
    return this.openTodos().filter(t => (t.effort || 0) > 0 && (t.effort || 0) <= 3 && this.isUrgent(t))
  });

  // 📅 Quadrant 2: Dringend & Aufwendig
  quadrantSchedule = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) > 3 && this.isUrgent(t))
  );

  // ⚡ Quadrant 3: Nicht dringend & Leicht
  quadrantDelegate = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) > 0 && (t.effort || 0) <= 3 && !this.isUrgent(t))
  );

  // ⏳ Quadrant 4: Nicht dringend & Aufwendig
  quadrantEliminate = computed(() =>
    this.openTodos().filter(t => (t.effort || 0) > 3 && !this.isUrgent(t))
  );

calculateRecommendation() {
    this.showAiRecommendation.set(true); 
  }

  // ⚡ Verarbeitet das detaillierte Event aus dem Popup
// ⚡ Verarbeitet das detaillierte Event aus dem Popup
  handleRecommendationResult(result: { accepted: boolean; todoId: string }) {
    console.log('KI-Vorschlag Ergebnis erhalten:', result);

    if (result.accepted) {
      console.log(`🎯 Starte To-Do mit ID: ${result.todoId}`);
      
      // 🚀 JETZT ECHT: Wir holen uns das exakt empfohlene To-Do direkt aus dem Service!
      const currentAiTodo = this.plannerService.recommendedTodo();
      if (currentAiTodo) {
        this.recommendedTodo.set(currentAiTodo);
        console.log("🎯 UI mit echtem KI To-Do befüllt:", currentAiTodo);
      }
    } else {
      console.log('💨 Vorschlag-Runde beendet.');
    }

    // Schließt das Popup
    this.showAiRecommendation.set(false);
  }
}