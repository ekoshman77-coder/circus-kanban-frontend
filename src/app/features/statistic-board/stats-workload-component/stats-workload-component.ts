import { Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';
import { UserService } from '../../../core/services/user/user-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { Project } from '../../../core/models/project';
import { ProjectService } from '../../../core/services/project/project-service';
import { TeamService } from '../../../core/services/team/team-service';

// ⚙️ REALISTISCHE RICHTWERTE (Später leicht auf PlannerSettings umstellbar!)
export const WORKLOAD_CONFIG = {
  MAX_DAILY_TASKS: 3,        // Realistisch: Max 3 Tasks pro Tag
  MAX_DAILY_POINTS: 3,       // Realistisch: Max 3 Story Points pro Tag
  HOURS_PER_POINT: 2.5       // Transparenz: 1 Point = ca. 2.5 Std.
};

export interface ColleagueHelpInfo {
  userId: string;
  userName: string;
  taskCount: number;
  pointsCount: number;
  todos: Array<{ id: string; task: string; effort: number }>;
}

@Component({
  selector: 'app-stats-workload',
  standalone: true,
  imports: [CommonModule, MilestoneSelectorComponent],
  templateUrl: './stats-workload-component.html',
  styleUrl: './stats-workload-component.css'
})
export class StatsWorkloadComponent {
  @Input({ required: true }) mode: StatMode = 'tasks';
  @Input({ required: true }) todayTodos: any[] = [];

  private userService = inject(UserService);
  private projectService = inject(ProjectService)
  private teamService = inject(TeamService)

  protected selectedProjectId = signal<string | null>(null);
  protected selectedMilestoneId = signal<string | null>(null);

  // --- PERSÖNLICHE TASKS DES USERS ---
  protected myTodayTodos = computed(() => {
    const currentUserId = this.userService.currentUser()?.id;
    if (!currentUserId) return [];

    return this.todayTodos.filter(t => 
      t.assignedUserId === currentUserId || (!t.assignedUserId && t.userId === currentUserId)
    );
  });

  // Überfällige Tasks herausfiltern (Deadline vor heute und noch offen)
  protected overdueTodos = computed(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.myTodayTodos().filter(t => !t.done && t.dueDate && new Date(t.dueDate) < todayStart);
  });

  // Summe der Punkte für heute
  protected todayPoints = computed(() => {
    return this.myTodayTodos().reduce((sum, t) => {
      const points = (t.done && t.usedEffort !== undefined && t.usedEffort !== null)
        ? t.usedEffort
        : (t.effort || 0);
      return sum + points;
    }, 0);
  });

  // Prozentuale Auslastung basierend auf den neuen Konstanten
  protected workloadPercent = computed(() => {
    const limit = this.mode === 'tasks' ? WORKLOAD_CONFIG.MAX_DAILY_TASKS : WORKLOAD_CONFIG.MAX_DAILY_POINTS;
    const current = this.mode === 'tasks' ? this.myTodayTodos().length : this.todayPoints();
    return Math.min((current / limit) * 100, 100);
  });

  // --- DYNAMISCHER METADATEN- & STATUS-TEXT ---
  protected workloadMeta = computed(() => {
    const myTodos = this.myTodayTodos();
    const count = this.mode === 'tasks' ? myTodos.length : this.todayPoints();
    const limit = this.mode === 'tasks' ? WORKLOAD_CONFIG.MAX_DAILY_TASKS : WORKLOAD_CONFIG.MAX_DAILY_POINTS;
    const overdueCount = this.overdueTodos().length;

    // 🚨 1. Prio: Überfällige Aufgaben aus der Vergangenheit
    if (overdueCount > 0) {
      return {
        color: '#dc2626',
        bg: '#fee2e2',
        border: '#fecaca',
        text: `🚨 Achtung! Du hast ${overdueCount} überfällige Leiche(n) aus der Vergangenheit. Bitte zuerst bereinigen!`
      };
    }

    // ☕ 2. Keine Tasks
    if (count === 0) {
      return {
        color: '#0ea5e9',
        bg: '#f0f9ff',
        border: '#bbf7d0',
        text: '☕ Tiefenentspannt! Heute steht nichts auf deiner Agenda. Zeit für einen Kaffee!'
      };
    }

    // 🟢 3. Im grünen Bereich (<= 60% des Tageslimits)
    if (count <= limit * 0.6) {
      return {
        color: '#166534',
        bg: '#dcfce7',
        border: '#bbf7d0',
        text: '🟢 Alles im grünen Bereich. Ein perfekt balancierter Tag für dich!'
      };
    }

    // 🟡 4. Optimale Auslastung (bis 100%)
    if (count <= limit) {
      return {
        color: '#ca8a04',
        bg: '#fef9c3',
        border: '#fef08a',
        text: '🟡 Optimale Auslastung erreicht! Mehr solltest du dir für heute nicht aufladen.'
      };
    }

    // 🔴 5. Überlastung
    return {
      color: '#dc2626',
      bg: '#fee2e2',
      border: '#fecaca',
      text: '🔴 Achtung, Überlastungsgefahr! Atme tief durch und verschiebe Aufgaben.'
    };
  });

  // --- TEAM-KOLLEGEN FÜR HILFE ---
protected colleaguesNeedingHelp = computed<ColleagueHelpInfo[]>(() => {
    const currentUserId = this.userService.currentUser()?.id;
    const activeMilestoneId = this.selectedMilestoneId();
    const activeProjectId = this.selectedProjectId();

    // 1. Nur offene Tasks von anderen Usern
    let filtered = this.todayTodos.filter(t => {
      const ownerOrAssignee = t.assignedUserId || t.userId;
      return !t.done && ownerOrAssignee && ownerOrAssignee !== currentUserId;
    });

    // 2. Projekt- / Meilenstein-Filter
    if (activeMilestoneId) {
      filtered = filtered.filter(t => String(t.milestoneId) === String(activeMilestoneId));
    } else if (activeProjectId) {
      const project = this.projectService.projectsList().find(p => String(p.id) === String(activeProjectId));
      const projectMilestoneIds = project?.milestones.map(m => String(m.id)) || [];
      filtered = filtered.filter(t => t.milestoneId && projectMilestoneIds.includes(String(t.milestoneId)));
    }

    // 3. User-Pool aus dem TeamService laden
    const members = this.teamService.globalMembersSignal();

    const userMap = new Map<string, ColleagueHelpInfo>();

    for (const task of filtered) {
      const uId = task.assignedUserId || task.userId;
      
      // Vor- und Nachname aus dem TeamService auslesen
      const member = members.find(m => m.user.id === uId);
      const user = member?.user;
      const userName = user 
        ? `${user.firstName} ${user.lastName}`.trim() 
        : `Kollege (${uId.slice(0, 4)})`;

      if (!userMap.has(uId)) {
        userMap.set(uId, {
          userId: uId,
          userName: userName,
          taskCount: 0,
          pointsCount: 0,
          todos: []
        });
      }

      const entry = userMap.get(uId)!;
      entry.taskCount += 1;
      entry.pointsCount += (task.effort || 0);
      entry.todos.push({
        id: task.id,
        task: task.task,
        effort: task.effort || 0
      });
    }

    return Array.from(userMap.values())
      .sort((a, b) => this.mode === 'tasks' ? b.taskCount - a.taskCount : b.pointsCount - a.pointsCount);
  });


  protected onProjectSelected(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.selectedMilestoneId.set(null);
  }

  protected onMilestoneSelected(milestoneId: string): void {
    this.selectedMilestoneId.set(milestoneId);
    this.selectedProjectId.set(null);
  }
}