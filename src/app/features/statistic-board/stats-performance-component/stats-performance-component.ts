import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';
import { Todo } from '../../../core/models/todo';
import { StreakInfoDto } from '../../../core/models/streak.info-dto';
import { OverviewFilter, StatFilterBarComponent } from '../../../core/shared/components/stat-filter-bar-component/stat-filter-bar-component';
import { Project } from '../../../core/models/project';
import { ProjectStreakInfo } from '../../../core/models/project-streak-info';
import { ProjectService } from '../../../core/services/project/project-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { ProjectStreakService } from '../../../core/services/project/project-streak-service';

@Component({
  selector: 'app-stats-performance',
  standalone: true,
  imports: [CommonModule, PercentPipe, StatFilterBarComponent],
  templateUrl: './stats-performance-component.html',
  styleUrl: './stats-performance-component.css'
})
export class StatsPerformanceComponent {
  private streakService = inject(ProjectStreakService)

  public mode = input<StatMode>('tasks');
  public completedTodos = input<Todo[]>([]);
  public streakInfo = input<StreakInfoDto | null>(null);
  public myProjects = input<Project[]>([]);

  // Signal für den aktiven Filter (wird von der Eltern-Komponente gereicht oder intern gesetzt)
  public activeFilter = signal<OverviewFilter>('all');

  protected setFilter(filter: OverviewFilter): void {
    this.activeFilter.set(filter);
  }

  // 🎯 Reaktiv den Projekt-Streak laden, sobald ein Projekt-Filter gewählt ist
  protected projectStreakInfo = toSignal(
    toObservable(this.activeFilter).pipe(
      switchMap(filter => {
        const selectedProject = this.myProjects().find(p => p.title === filter || p.id === filter);

        if (selectedProject) {
          return this.streakService.getProjectStreakInfo(selectedProject.id); // ✅ Schickt project.id!
        }
        return of(null);
      })
    ),
    { initialValue: null }
  );

  // 🎯 Ist ein spezifisches Projekt ausgewählt?
  protected isSpecificProjectFilter = computed(() => {
    const f = this.activeFilter();
    return this.myProjects().some(p => p.title === f || p.id === f);
  });

  // 🎯 Steuer-Signal für die Sichtbarkeit der Streak-Kachel
  protected showStreakCard = computed(() => {
    // Anzeigen bei: Privatem Filter, eigenen Teams ODER wenn ein spezifisches Projekt gewählt ist
    return true;
  });

  // --- DYNAMISCHE STREAK-WERTE (User vs. Projekt) ---

  protected get isShieldActive(): boolean {
    if (this.isSpecificProjectFilter()) {
      return this.projectStreakInfo()?.isShieldActive ?? false;
    }
    return this.streakInfo()?.isShieldActive ?? false;
  }

  protected get currentStreak(): number {
    if (this.isSpecificProjectFilter()) {
      return this.projectStreakInfo()?.streakDays ?? 0;
    }
    return this.streakInfo()?.streakDays ?? 0;
  }

// Für das Zusatz-Label in der Streak-Kachel
  protected get streakSubText(): string {
    if (this.isSpecificProjectFilter()) {
      const p = this.projectStreakInfo();
      // Sichere Prüfung: Kommen Daten vom Server?
      if (!p) {
        return 'Keine Streak-Daten verfügbar';
      }
      return `${p.todaysContributedMembers} von ${p.requiredMembersCount} im Team aktiv`;
    }
    return this.isShieldActive ? 'Aktiv geschützt' : 'in Folge aktiv';
  }

  protected get streakTitle(): string {
    if (this.isSpecificProjectFilter()) {
      return 'Projekt-Akku';
    }
    return this.isShieldActive ? 'Ticket-Schild' : 'Aktiv-Streak';
  }

protected get streakMeta() {
    if (this.isSpecificProjectFilter()) {
      const p = this.projectStreakInfo();
      // 🛡️ Falls der Server null liefert -> graue/neutrale Darstellung
      if (!p) return { color: '#64748b' }; 

      const percentage = p.batteryPercentage ?? 0;
      if (percentage >= 80) return { color: '#166534' };
      if (percentage >= 30) return { color: '#1e40af' };
      return { color: '#ea580c' };
    }

    if (this.isShieldActive) {
      return { color: '#1e40af' };
    }

    const s = this.currentStreak;
    if (s === 0) return { color: '#64748b' };
    if (s <= 2) return { color: '#1e40af' };
    if (s <= 5) return { color: '#b45309' };
    return { color: '#166534' };
  }
  
  // ... (Restliche Methoden wie expressCount, estimationEfficiency, leadTime etc. bleiben unverändert)
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

}