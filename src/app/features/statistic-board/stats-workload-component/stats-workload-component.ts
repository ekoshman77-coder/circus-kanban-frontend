import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';

@Component({
  selector: 'app-stats-workload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-workload-component.html',
  styleUrl: './stats-workload-component.css'
})
export class StatsWorkloadComponent {
  @Input({ required: true }) mode: StatMode = 'tasks';
  @Input({ required: true }) todayTodos: any[] = [];

  // --- REAKTIVE BERECHNUNGEN ---

  // Summe der Fibonacci-Punkte für heute
  protected todayPoints = computed(() => {
    return this.todayTodos.reduce((sum, t) => sum + (t.effort || 0), 0);
  });

  // Prozentuale Auslastung berechnen (gedeckelt bei max 100% für die Bar, aber die Zahl zählt weiter!)
  protected workloadPercent = computed(() => {
    if (this.mode === 'tasks') {
      return Math.min((this.todayTodos.length / 5) * 100, 100);
    } else {
      return Math.min((this.todayPoints() / 8) * 100, 100);
    }
  });

  // Dynamische Farben und motivierende Texte je nach Auslastung
  protected workloadMeta = computed(() => {
    const percent = this.workloadPercent();
    const count = this.mode === 'tasks' ? this.todayTodos.length : this.todayPoints();
    const limit = this.mode === 'tasks' ? 5 : 8;

    if (count === 0) {
      return {
        color: '#0ea5e9',
        bg: '#f0f9ff',
        border: '#bbf7d0',
        text: '☕ Tiefenentspannt! Heute steht nichts auf der Agenda. Zeit zum Durchatmen!'
      };
    }
    if (count <= limit * 0.6) {
      return {
        color: '#166534',
        bg: '#dcfce7',
        border: '#bbf7d0',
        text: '🟢 Alles im grünen Bereich. Ein perfekt balancierter Tag!'
      };
    }
    if (count <= limit) {
      return {
        color: '#9a3412',
        bg: '#fef9c3',
        border: '#fef08a',
        text: '🟡 Gut ausgelastet. Konzentrier dich auf das Wesentliche, dann schaffst du das!'
      };
    }
    return {
      color: '#991b1b',
      bg: '#fee2e2',
      border: '#fca5a5',
      text: '⚠️ Achtung, Überlastung! Dein Tag ist extrem voll. Priorisiere weise!'
    };
  });
}