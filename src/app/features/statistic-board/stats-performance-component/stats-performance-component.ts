import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';
import { Todo } from '../../../core/models/todo';
import { StreakInfoDto } from '../../../core/models/streak.info-dto';
import { OverviewFilter, StatFilterBarComponent } from '../../../core/shared/components/stat-filter-bar-component/stat-filter-bar-component';
import { Project } from '../../../core/models/project';
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
  private streakService = inject(ProjectStreakService);

  public mode = input<StatMode>('tasks');
  public completedTodos = input<Todo[]>([]);
  public streakInfo = input<StreakInfoDto | null>(null);
  public myProjects = input<Project[]>([]);

  // Signal für den aktiven Filter
  public activeFilter = signal<OverviewFilter>('all');

  protected setFilter(filter: OverviewFilter): void {
    this.activeFilter.set(filter);
  }

  // 🎯 Reaktiv gefilterte erledigte Aufgaben für alle Performance-Berechnungen
  protected filteredCompletedTodos = computed(() => {
    const todos = this.completedTodos();
    const filter = this.activeFilter();

    if (filter === 'all') return todos;
    if (filter === 'personal') return todos.filter(t => !t.milestoneId);
    if (filter === 'team') return todos.filter(t => !!t.milestoneId);

    // Projekt-Filter ohne extra Service
    const selectedProject = this.myProjects().find(p => p.title === filter || p.id === filter);
    if (selectedProject && selectedProject.milestones) {
      const projectMilestoneIds = new Set(selectedProject.milestones.map(m => m.id));
      return todos.filter(t => t.milestoneId && projectMilestoneIds.has(t.milestoneId));
    }

    return todos;
  });

  // 🎯 Projekt-Streak laden
  protected projectStreakInfo = toSignal(
    toObservable(this.activeFilter).pipe(
      switchMap(filter => {
        const selectedProject = this.myProjects().find(p => p.title === filter || p.id === filter);
        if (selectedProject) {
          return this.streakService.getProjectStreakInfo(selectedProject.id);
        }
        return of(null);
      })
    ),
    { initialValue: null }
  );

  protected isSpecificProjectFilter = computed(() => {
    const f = this.activeFilter();
    return this.myProjects().some(p => p.title === f || p.id === f);
  });

  protected showStreakCard = computed(() => true);

  // --- STREAK GETTER ---

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

  protected get streakSubText(): string {
    if (this.isSpecificProjectFilter()) {
      const p = this.projectStreakInfo();
      if (!p) return 'Keine Streak-Daten verfügbar';
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

  protected showTeamPerformance = computed(() => this.activeFilter() === 'team');

  // --- PERFORMANCE METRIKEN (Nutzen alle filteredCompletedTodos) ---

  protected get expressCount(): number {
    return this.filteredCompletedTodos().filter(t => t.isExpress).length;
  }

  protected get expressRatio(): number {
    if (this.filteredCompletedTodos().length === 0) return 0;
    return this.expressCount / this.filteredCompletedTodos().length;
  }

  protected get totalPlannedPoints(): number {
    return this.filteredCompletedTodos().reduce((sum, t) => sum + (t.effort || 0), 0);
  }

  protected get totalUsedPoints(): number {
    return this.filteredCompletedTodos().reduce((sum, t) => sum + (t.usedEffort || 0), 0);
  }

  protected get estimationEfficiency(): number {
    if (this.totalUsedPoints === 0) return 0;
    return this.totalPlannedPoints / this.totalUsedPoints;
  }

  protected get predictabilityScore(): number {
    if (this.filteredCompletedTodos().length === 0) return 0;
    const exactMatches = this.filteredCompletedTodos().filter(t => t.usedEffort === t.effort).length;
    return exactMatches / this.filteredCompletedTodos().length;
  }

  protected get totalEffortManipulations(): number {
    return this.filteredCompletedTodos().reduce((sum, t) => sum + (t.effortChangesCount || 0), 0);
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
    if (this.filteredCompletedTodos().length === 0) return 0;

    const totalDays = this.filteredCompletedTodos().reduce((sum, t) => {
      if (!t.completedAt || !t.createdAt) return sum;
      const diffMs = Math.abs(new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime());
      return sum + (diffMs / (1000 * 60 * 60 * 24));
    }, 0);

    const average = totalDays / this.filteredCompletedTodos().length;
    return Math.round(average * 10) / 10;
  }

  protected get leadTimeMeta() {
    const days = this.averageLeadTime;
    if (this.filteredCompletedTodos().length === 0) return { color: '#64748b', text: 'Noch keine Daten.' };

    if (days <= 1) {
      return { color: '#166534', text: '⚡ Überschall-Tempo! Aufgaben fliegen regelrecht bei dir durch.' };
    }
    if (days <= 3) {
      return { color: '#1e40af', text: '🏃‍♂️ Guter Rhythmus! Deine Aufgaben bleiben nicht lange liegen.' };
    }
    return { color: '#b45309', text: '🐢 Gemächlicher Fluss! Manche Aufgaben brauchen etwas Reifezeit.' };
  }
}