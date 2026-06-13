import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; // Passe den Pfad zu deinem Service an!
import { StatsOverviewComponent } from '../stats-overview-component/stats-overview-component';
import { StatsPerformanceComponent } from '../stats-performance-component/stats-performance-component';
import { StatsWorkloadComponent } from '../stats-workload-component/stats-workload-component';

export type StatMode = 'tasks' | 'points';
export type StatTab = 'overview' | 'performance' | 'workload';

@Component({
  selector: 'app-statistic',
  standalone: true,
  imports: [
    CommonModule, 
    StatsOverviewComponent, 
    StatsPerformanceComponent, 
    StatsWorkloadComponent
  ],
  templateUrl: './statistic-board-component.html',
  styleUrl: './statistic-board-component.css'
})
export class StatisticBoardComponent {
  // 🚀 Wir holen uns den Service direkt hier rein
  private todoService = inject(TodoService);

  // Die beiden Steuer-Zustände für Buttons und Tabs
  protected currentMode = signal<StatMode>('tasks');
  protected currentTab = signal<StatTab>('overview');

  // ⚡ DEIN NEUES SIGNAL: Wir nutzen direkt deine ungefilterte Master-Liste!
  protected allTodos = this.todoService.allTodos;

  // --- REAKTIVE FILTER FÜR DIE UNTERSEITEN (reagieren sofort auf dein Service-Signal) ---

  // 1. Alle offenen Aufgaben
  protected openTodos = computed(() => 
    this.allTodos().filter(t => !t.done)
  );

  // 2. Alle erledigten Aufgaben
  protected completedTodos = computed(() => 
    this.allTodos().filter(t => t.done)
  );

  // 3. Alle überfälligen Aufgaben (Offen und Datum liegt vor heute)
  protected overdueTodos = computed(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.allTodos().filter(t => !t.done && t.dueDate && new Date(t.dueDate) < todayStart);
  });

  // 4. Alle Aufgaben für HEUTE
  protected todayTodos = computed(() => {
    const today = new Date();
    return this.allTodos().filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getDate() === today.getDate() &&
             d.getMonth() === today.getMonth() &&
             d.getFullYear() === today.getFullYear();
    });
  });

  // --- NAVIGATION ---
  protected setMode(mode: StatMode): void {
    this.currentMode.set(mode);
  }

  protected setTab(tab: StatTab): void {
    this.currentTab.set(tab);
  }
}