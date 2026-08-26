import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service';
import { UserService } from '../../../core/services/user/user-service';
import { TodoOverviewComponent } from '../todo-overview-component/todo-overview-component';
import { StatsPerformanceComponent } from '../stats-performance-component/stats-performance-component';
import { StatsWorkloadComponent } from '../stats-workload-component/stats-workload-component';
import { StatisticOverviewComponent } from '../statistic-overview-component/statistic-overview-component';
import { TeamService } from '../../../core/services/team/team-service';
import { Project } from '../../../core/models/project';
import { ProjectService } from '../../../core/services/project/project-service';

export type StatMode = 'tasks' | 'points';
export type StatTab = 'statistic-overview' | 'todo-overview' | 'performance' | 'workload';
export type ViewMode = 'personal' | 'team';

@Component({
  selector: 'app-statistic',
  standalone: true,
  imports: [
    CommonModule,
    TodoOverviewComponent,
    StatsPerformanceComponent,
    StatsWorkloadComponent,
    StatisticOverviewComponent
  ],
  templateUrl: './statistic-board-component.html',
  styleUrl: './statistic-board-component.css'
})
export class StatisticBoardComponent {
  // Services
  protected todoService = inject(TodoService);
  private projectService = inject(ProjectService);
  protected userService = inject(UserService); // Nutzen den UserService für User-ID

  // Die Steuer-Zustände für Buttons, Tabs & Ansichten
  public currentMode = signal<StatMode>('tasks');
  protected currentTab = signal<StatTab>('statistic-overview');
  public activeView = signal<ViewMode>('personal'); // 🎯 NEU: Ansichts-Schalter
  public streakInfo = this.todoService.streakState

  // ⚡ Ungefilterte Master-Liste aus deinem TodoService
  protected allTodos = this.todoService.allTodos;

  public privateTodos = this.todoService.privateTodos;

  public teamTodos = computed(() =>
    this.allTodos().filter(t => !!t.milestoneId)
  );

  public myTeamTodos = this.todoService.focusedTodos;

  // Projects-Berechnung
  public myProjects = computed(() => {
    const todos = this.teamTodos();
    const projectsList = this.projectService.projectsList();

    const milestoneIds = new Set(todos.map(t => t.milestoneId).filter((id): id is string => !!id));

    return projectsList.filter(project =>
      project.milestones?.some(ms => milestoneIds.has(ms.id))
    );
  });

  // --- REAKTIVE FILTER FÜR DIE UNTERSEITEN ---

  // 1. Alle offenen Aufgaben
  protected openTodos = computed(() => {
    return this.allTodos().filter(t => !t.done);
  });

  // 2. Alle erledigten Aufgaben (Gesamt)
  protected completedTodos = computed(() =>
    this.allTodos().filter(t => t.done)
  );

  // 🎯 2b. Gefilterte erledigte Aufgaben (Persönlich vs. Team) für die Performance-Komponente
  public filteredCompletedTodos = computed(() => {
    const allCompleted = this.completedTodos();
    const currentUserId = this.userService.getCurrentUserId();

    if (this.activeView() === 'personal') {
      return allCompleted.filter(t => t.userId === currentUserId);
    } else {
      // Team-Ansicht: Nur Aufgaben mit zugewiesener milestoneId
      return allCompleted.filter(t => !!t.milestoneId);
    }
  });

  // 3. Alle überfälligen Aufgaben
  protected overdueTodos = computed(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.allTodos().filter(t => !t.done && t.dueDate && new Date(t.dueDate) < todayStart);
  });

  // 4. UNVERÄNDERT: Deine originale todayTodos-Berechnung
  protected todayTodos = computed(() => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todos = this.allTodos().filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);

      // Offen & fällig bis Ende heute
      const isDueOrOverdue = !t.done && dueDate <= todayEnd;

      // Oder heute erledigt
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const isDoneToday = t.done && dueDate >= todayStart && dueDate <= todayEnd;

      return isDueOrOverdue || isDoneToday;
    });
    console.log('TODAY TODOS:', todos);
    return todos;
  });

  // --- NAVIGATION ---
  protected setMode(mode: StatMode): void {
    this.currentMode.set(mode);
  }

  protected setTab(tab: StatTab): void {
    this.currentTab.set(tab);
  }

  public setView(newView: ViewMode): void {
    this.activeView.set(newView);
  }
}