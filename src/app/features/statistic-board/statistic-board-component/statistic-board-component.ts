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

  public myTeamTodos = this.todoService.userContributionTodos;

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

  // ⚡ PERFORMANCE: Berücksichtigt auch absolvierte Reviews im Personal View
  public filteredCompletedTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];

    if (this.activeView() === 'personal') {
      return this.allTodos().filter(t => {
        const isDone = t.done || t.teamStatus === 'DONE';
        if (!isDone) return false;

        const isMyPrivate = !t.milestoneId && t.userId === currentUserId;
        const isMyDevWork = t.lastDeveloperId === currentUserId;
        const isMyReviewWork = t.reviewerId === currentUserId;

        return isMyPrivate || isMyDevWork || isMyReviewWork;
      });
    } else {
      return this.allTodos().filter(t => (t.done || t.teamStatus === 'DONE') && !!t.milestoneId);
    }
  });

  // 3. Alle überfälligen Aufgaben
  protected overdueTodos = computed(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.allTodos().filter(t => !t.done && t.dueDate && new Date(t.dueDate) < todayStart);
  });

  // 4. UNVERÄNDERT: Deine originale todayTodos-Berechnung
// ⏳ HEUTE-AUSLASTUNG: Erweitert um "Heute im Review"
  protected todayTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.allTodos().filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);

      // Eigene offene Aufgaben oder Aufgaben, die bei mir im Review liegen
      const isMyTaskDue = (t.assignedUserId === currentUserId || !t.milestoneId) && !t.done && dueDate <= todayEnd;
      const isWaitingForMyReview = t.reviewerId === currentUserId && t.teamStatus === 'REVIEW';
      const isDoneToday = (t.done || t.teamStatus === 'DONE') && dueDate >= todayStart && dueDate <= todayEnd;

      return isMyTaskDue || isWaitingForMyReview || isDoneToday;
    });
  });

  public inMyReviewTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];
    return this.allTodos().filter(t => 
      t.reviewerId === currentUserId && !t.done && t.teamStatus === 'REVIEW'
    );
  });

  // 🔎 2. Bei anderen im Review (Deine Tasks, die auf Review warten)
  public inOtherReviewTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];
    return this.allTodos().filter(t => 
      t.lastDeveloperId === currentUserId && !t.done && t.teamStatus === 'REVIEW'
    );
  });

  // 🎉 3. Von dir erfolgreich freigegebene/geprüfte Reviews
  public completedReviewedTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];
    return this.allTodos().filter(t => 
      t.reviewerId === currentUserId && (t.done || t.teamStatus === 'DONE')
    );
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