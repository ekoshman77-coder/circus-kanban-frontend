import { Component, Input, computed } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { Todo } from '../../../core/models/todo';

// Definiere das Interface direkt hier, damit es überall sauber matcht
export interface TodoStats {
  total: number;
  open: number;
  overdue: number;
  completed: number;
  dueToday: number;
}

/**
 * 🧮 DIE RECHEN-MASCHINE (Deine Utility):
 * Nimmt eine beliebige Todo-Liste und berechnet die Statistik fehlerfrei!
 */
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
  // Wir bekommen die rohen Zahlen aus der Hauptkomponente geliefert
  @Input() stats: TodoStats = { total: 0, open: 0, overdue: 0, completed: 0, dueToday: 0 };

  // Der mathematische Fix für die 133%: Erledigt geteilt durch Gesamt!
  // Wir nutzen ein computed Signal (oder eine einfache Methode), um den Wert sauber zu berechnen
  get calculatedPercent(): number {
    if (!this.stats || this.stats.total === 0) {
      return 0;
    }
    // Formel: (Erledigte / Gesamt)
    // Angulars eingebaute PercentPipe macht daraus später automatisch z.B. 0.75 -> 75%
    return this.stats.completed / this.stats.total;
  }
}