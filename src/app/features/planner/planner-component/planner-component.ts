import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { Todo } from '../../../core/models/todo'; 
import { UserService } from '../../../core/services/user/user-service';

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planner-component.html',
  styleUrls: ['./planner-component.css']
})
export class PlannerComponent {
  private todoService = inject(TodoService);
  private userService = inject(UserService); // 🌟 Bestens angebunden!

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
  quadrantDoFirst = computed(() => 
    this.openTodos().filter(t => (t.effort || 0) > 0 && (t.effort || 0) <= 3 && this.isUrgent(t))
  );

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
    // 1. Grund-Pool: Alle offenen, echten To-Dos
    const allOpenTasks = [...this.openTodos().filter(t => (t.effort || 0) > 0)];
    
    const energy = this.userService.userEnergy();
    const hoursLeft = this.userService.workingTimeLeft();

    // 2. Wir filtern den "Traum-Pool" (Sachen, die perfekt in Zeit & Energie passen)
    let perfectMatchPool = allOpenTasks.filter(t => (t.effort || 0) <= hoursLeft);

    if (energy === 'low') {
      perfectMatchPool = perfectMatchPool.filter(t => (t.effort || 0) <= 2);
    } else if (energy === 'high') {
      const heavyTasks = perfectMatchPool.filter(t => (t.effort || 0) >= 3);
      if (heavyTasks.length > 0) perfectMatchPool = heavyTasks;
    }

    // 🌟 BIOLOGISCHE ZEIT-LOGIK: Sind wir JETZT in der genetischen Prime-Time?
    const currentHour = new Date().getHours();
    const startHour = this.userService.primeTimeStartHour();
    const endHour = this.userService.primeTimeEndHour();
    const isInsidePrimeTime = currentHour >= startHour && currentHour < endHour;

    // 3. Wenn dringende Sachen im "Perfekten Pool" sind, sortieren wir sie nach Biorhythmus
    const urgentPerfectItems = perfectMatchPool.filter(t => this.isUrgent(t));
    
    if (urgentPerfectItems.length > 0) {
      if (isInsidePrimeTime && energy !== 'low') {
        // 🔥 Prime-Time & Akzeptable Energie: Größter Brocken zuerst (Absteigend: 3, 2, 1)
        urgentPerfectItems.sort((a, b) => (b.effort || 0) - (a.effort || 0));
      } else {
        // 🥱 Außerhalb oder Akut Müde: "Quick Wins" zuerst (Aufsteigend: 1, 2, 3)
        urgentPerfectItems.sort((a, b) => (a.effort || 0) - (b.effort || 0));
      }
      this.recommendedTodo.set(urgentPerfectItems[0]);
      return;
    }

    // 4. Wenn keine dringenden, aber normale "Perfekte Aufgaben" da sind:
    if (perfectMatchPool.length > 0) {
      if (isInsidePrimeTime && energy !== 'low') {
        perfectMatchPool.sort((a, b) => (b.effort || 0) - (a.effort || 0));
      } else {
        perfectMatchPool.sort((a, b) => (a.effort || 0) - (b.effort || 0));
      }
      this.recommendedTodo.set(perfectMatchPool[0]);
      return;
    }

    // ==========================================================================
    // 🌴 DEIN RECHERCHE-MODUS (FALLBACK)
    // Wenn wir hier landen, gibt es KEINE perfekte Aufgabe mehr für die Müdigkeit/Zeit.
    // Anstatt null zu geben, empfehlen wir die größte verbleibende Aufgabe zum Einlesen!
    // ==========================================================================
    if (allOpenTasks.length > 0) {
      allOpenTasks.sort((a, b) => (b.effort || 0) - (a.effort || 0));
      this.recommendedTodo.set(allOpenTasks[0]);
    } else {
      this.recommendedTodo.set(null);
    }
  }
}