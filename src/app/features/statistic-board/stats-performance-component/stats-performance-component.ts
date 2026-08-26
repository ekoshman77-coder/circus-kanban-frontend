import { Component, computed, input, signal } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';
import { Todo } from '../../../core/models/todo';
import { StreakInfoDto } from '../../../core/models/streak.info-dto';
import { OverviewFilter, StatFilterBarComponent } from '../../../core/shared/components/stat-filter-bar-component/stat-filter-bar-component';
import { Project } from '../../../core/models/project';

@Component({
  selector: 'app-stats-performance',
  standalone: true,
  imports: [CommonModule, PercentPipe, StatFilterBarComponent],
  templateUrl: './stats-performance-component.html',
  styleUrl: './stats-performance-component.css'
})
export class StatsPerformanceComponent {
  public mode = input<StatMode>('tasks');
  public completedTodos = input<Todo[]>([]);
  public streakInfo = input<StreakInfoDto | null>(null);
  public myProjects = input<Project[]>([]);

  // Signal für den aktiven Filter (wird von der Eltern-Komponente gereicht oder intern gesetzt)
  public activeFilter = signal<OverviewFilter>('all');

  protected setFilter(filter: OverviewFilter): void {
    this.activeFilter.set(filter);
  }

  // 🎯 Steuer-Signale für die Sichtbarkeit der Kacheln
  protected showStreakCard = computed(() => {
    const filter = this.activeFilter();
    return filter === 'private' || filter === 'my-team' || (filter !== 'all' && filter !== 'team');
  });

  protected showTeamPerformance = computed(() => {
    return this.activeFilter() === 'team';
  });

  // 1. Aufgaben-Modus: Express-Aufgaben
  protected get expressCount(): number {
    return this.completedTodos().filter(t => t.isExpress).length;
  }

  protected get expressRatio(): number {
    if (this.completedTodos().length === 0) return 0;
    return this.expressCount / this.completedTodos().length;
  }

  // 2. Punkte-Modus: Schätz-Effizienz
  protected get totalPlannedPoints(): number {
    return this.completedTodos().reduce((sum, t) => sum + (t.effort || 0), 0);
  }

  protected get totalUsedPoints(): number {
    return this.completedTodos().reduce((sum, t) => sum + (t.usedEffort || 0), 0);
  }

  protected get estimationEfficiency(): number {
    if (this.totalUsedPoints === 0) return 0;
    return this.totalPlannedPoints / this.totalUsedPoints;
  }

  // 🎯 Predictability Score
  protected get predictabilityScore(): number {
    if (this.completedTodos().length === 0) return 0;
    const exactMatches = this.completedTodos().filter(t => t.usedEffort === t.effort).length;
    return exactMatches / this.completedTodos().length;
  }

  // 🕵️‍♂️ Ehrlichkeits-Tracker
  protected get totalEffortManipulations(): number {
    return this.completedTodos().reduce((sum, t) => sum + (t.effortChangesCount || 0), 0);
  }

  protected get efficiencyMeta() {
    const eff = this.estimationEfficiency;
    if (eff === 0) return { color: '#64748b', bg: '#f1f5f9', text: 'Noch keine Daten verfügbar.' };

    if (eff >= 0.9 && eff <= 1.1) {
      return { color: '#166534', bg: '#dcfce7', text: '🎯 Perfekt geschätzt! Du kennst dein Tempo genau.' };
    }
    if (eff > 1.1) {
      return { color: '#1e40af', bg: '#dbeafe', text: '🚀 Express-Tempo! Du warst im Schnitt schneller als deine Schätzungen.' };
    }
    return { color: '#9a3412', bg: '#ffedd5', text: '🥵 Komplexe Hürden! Du hast im Schnitt länger gebraucht als geplant.' };
  }

  protected get predictabilityMeta() {
    const score = this.predictabilityScore * 100;
    if (score >= 80) return { color: '#166534', text: '🧙‍♂️ Meister-Stratege! Deine Punktlandungen sind überragend.' };
    if (score >= 50) return { color: '#1e40af', text: '📋 Solider Planer! Du kannst deine Kraft gut einschätzen.' };
    return { color: '#b45309', text: '🏃‍♂️ Fleißiger Macher! Nimm dir beim Schätzen ruhig etwas mehr Zeit.' };
  }

  protected get predictabilityHue(): number {
    return this.predictabilityScore * 120;
  }

  protected get averageLeadTime(): number {
    if (this.completedTodos().length === 0) return 0;

    const totalDays = this.completedTodos().reduce((sum, t) => {
      if (!t.completedAt || !t.createdAt) return sum;

      const diffMs = Math.abs(t.completedAt - t.createdAt);
      return sum + (diffMs / (1000 * 60 * 60 * 24));
    }, 0);

    const average = totalDays / this.completedTodos().length;
    return Math.round(average * 10) / 10;
  }

  protected get leadTimeMeta() {
    const days = this.averageLeadTime;
    if (this.completedTodos().length === 0) return { color: '#64748b', text: 'Noch keine Daten.' };

    if (days <= 1) {
      return { color: '#166534', text: '⚡ Überschall-Tempo! Aufgaben fliegen regelrecht bei dir durch.' };
    }
    if (days <= 3) {
      return { color: '#1e40af', text: '🏃‍♂️ Guter Rhythmus! Deine Aufgaben bleiben nicht lange liegen.' };
    }
    return { color: '#b45309', text: '🐢 Gemächlicher Fluss! Manche Aufgaben brauchen etwas Reifezeit.' };
  }

  // 🔥 Echter Streak-Wert aus dem Backend-DTO
  protected get currentStreak(): number {
    return this.streakInfo()?.streakDays ?? 0;
  }

  protected get isShieldActive(): boolean {
    return this.streakInfo()?.isShieldActive ?? false;
  }

  protected get streakMeta() {
    if (this.isShieldActive) {
      return { color: '#1e40af', text: '🛡️ Ticket-Schild aktiv! Dein Puffer ist geschützt.' };
    }

    const s = this.currentStreak;
    if (s === 0) return { color: '#64748b', text: 'Fang heute eine neue Serie an! 🚀' };
    if (s <= 2) return { color: '#1e40af', text: 'Guter Start! Halte die Kette am Leben. 🌱' };
    if (s <= 5) return { color: '#b45309', text: 'Du bist im Tunnel! Richtig starke Konstanz. 🔥' };
    return { color: '#166534', text: '👑 Unaufhaltbar! Du bist ein absoluter Produktivitäts-Gott!' };
  }
}