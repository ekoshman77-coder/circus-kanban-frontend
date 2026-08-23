import { Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';
import { UserService } from '../../../core/services/user/user-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';

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

  // Speichert die aktive Auswahl
  protected selectedProjectId = signal<string | null>(null);
  protected selectedMilestoneId = signal<string | null>(null);

  // 🎯 Filtert die Aufgaben der Kollegen dynamisch
  protected colleaguesNeedingHelp = computed(() => {
    const currentUserId = this.userService.currentUser()?.id;
    const activeMilestoneId = this.selectedMilestoneId();
    const activeProjectId = this.selectedProjectId();

    // 1. Nur offene Tasks von anderen Kollegen betrachten
    let filtered = this.todayTodos.filter(t => !t.done && t.assignedUserId && t.assignedUserId !== currentUserId);

    // 2. Granulare Filterung: Meilenstein hat Vorrang vor Projekt
    if (activeMilestoneId) {
      filtered = filtered.filter(t => t.milestoneId === activeMilestoneId);
    } else if (activeProjectId) {
      filtered = filtered.filter(t => t.projectId === activeProjectId || t.milestoneProjectId === activeProjectId);
    }

    // 3. Nach Kollegen Gruppieren
    const userMap = new Map<string, { userId: string, taskCount: number, pointsCount: number }>();

    for (const task of filtered) {
      const uId = task.assignedUserId;
      if (!userMap.has(uId)) {
        userMap.set(uId, { userId: uId, taskCount: 0, pointsCount: 0 });
      }
      const entry = userMap.get(uId)!;
      entry.taskCount += 1;
      entry.pointsCount += (task.effort || 0);
    }

    // 4. Sortieren: Wer am meisten Hilfe braucht, steht oben
    return Array.from(userMap.values())
      .sort((a, b) => this.mode === 'tasks' ? b.taskCount - a.taskCount : b.pointsCount - a.pointsCount);
  });

  // Event-Handler
  protected onProjectSelected(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.selectedMilestoneId.set(null); // Meilenstein-Filter zurücksetzen
  }

  protected onMilestoneSelected(milestoneId: string): void {
    this.selectedMilestoneId.set(milestoneId);
    this.selectedProjectId.set(null); // Projekt-Filter zurücksetzen
  }

  // --- REAKTIVE FILTERUNG FÜR PERSÖNLICHEN WORKLOAD ---

  // Wir filtern die übergebenen Todos so, dass NUR deine eigenen Aufgaben zählen!
  protected myTodayTodos = computed(() => {
    const currentUserId = this.userService.currentUser()?.id;
    if (!currentUserId) return [];

    return this.todayTodos.filter(t => t.assignedUserId === currentUserId || (!t.assignedUserId && t.userId === currentUserId));
  });

  // Summe der Punkte für heute (tatsächlicher Aufwand für erledigte, geplanter Aufwand für offene!)
  protected todayPoints = computed(() => {
    return this.myTodayTodos().reduce((sum, t) => {
      // Wenn das Ticket erledigt ist und wir tatsächliche Punkte eingetragen haben, nehmen wir diese.
      // Ansonsten nehmen wir den geschätzten Aufwand (effort).
      const points = (t.done && t.usedEffort !== undefined && t.usedEffort !== null)
        ? t.usedEffort
        : (t.effort || 0);
      return sum + points;
    }, 0);
  });

  // Prozentuale Auslastung berechnen (gedeckelt bei max 100% für die Bar)
  protected workloadPercent = computed(() => {
    if (this.mode === 'tasks') {
      return Math.min((this.myTodayTodos().length / 5) * 100, 100);
    } else {
      return Math.min((this.todayPoints() / 8) * 100, 100);
    }
  });

  // Dynamische Farben und motivierende Texte je nach Auslastung
  protected workloadMeta = computed(() => {
    const percent = this.workloadPercent();
    const count = this.mode === 'tasks' ? this.myTodayTodos().length : this.todayPoints();
    const limit = this.mode === 'tasks' ? 5 : 8;

    if (count === 0) {
      return {
        color: '#0ea5e9',
        bg: '#f0f9ff',
        border: '#bbf7d0',
        text: '☕ Tiefenentspannt! Heute steht nichts auf deiner Agenda. Zeit für einen Kaffee!'
      };
    }
    if (count <= limit * 0.6) {
      return {
        color: '#166534',
        bg: '#dcfce7',
        border: '#bbf7d0',
        text: '🟢 Alles im grünen Bereich. Ein perfekt balancierter Tag für dich!'
      };
    }
    if (count <= limit) {
      return {
        color: '#ca8a04',
        bg: '#fef9c3',
        border: '#fef08a',
        text: '🟡 Optimale Auslastung erreicht! Mehr solltest du dir für heute nicht vornehmen.'
      };
    }
    return {
      color: '#dc2626',
      bg: '#fee2e2',
      border: '#fecaca',
      text: '🔴 Achtung, Überlastungsgefahr! Atme tief durch und verteile Aufgaben auf morgen.'
    };
  });
}