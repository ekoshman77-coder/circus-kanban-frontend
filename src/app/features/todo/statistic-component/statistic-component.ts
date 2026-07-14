import { Component, computed, input } from '@angular/core'; // 🌟 input und computed importiert
import { CommonModule, PercentPipe } from '@angular/common';
import { Todo } from '../../../core/models/todo';

export interface TodoStats {
  total: number;
  open: number;
  overdue: number;
  completed: number;
  dueToday: number;
}

export function calculateTodoStats(todos: Todo[]): TodoStats {
  const stats: TodoStats = { total: todos.length, open: 0, overdue: 0, completed: 0, dueToday: 0 };
  
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEnd = new Date().setHours(23, 59, 59, 999);

  todos.forEach(todo => {
    if (todo.done) {
      stats.completed++;
    } else {
      stats.open++;
      if (todo.dueDate < now) stats.overdue++;
      if (todo.dueDate >= todayStart && todo.dueDate <= todayEnd) stats.dueToday++;
    }
  });

  return stats;
}

@Component({
  selector: 'app-statistic',
  standalone: true,
  imports: [CommonModule, PercentPipe],
  templateUrl: './statistic-component.html',
  styleUrl: './statistic-component.css'
})
export class StatisticComponent {
  // 🌟 NEU: Wir verlangen die Todo-Liste statt der fertigen Zahlen!
  public todos = input.required<Todo[]>();

  // 🌟 REAKTIVE BERECHNUNG: Die Statistik berechnet sich vollautomatisch
  public stats = computed(() => {
    return calculateTodoStats(this.todos());
  });

  protected get calculatedPercent(): number {
    const s = this.stats(); // Signal auslesen mit ()
    if (s.total === 0) return 0;
    return s.completed / s.total;
  }
}