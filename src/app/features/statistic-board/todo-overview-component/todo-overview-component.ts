import { Component, computed, input, signal } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { Todo } from '../../../core/models/todo';
import { Project } from '../../../core/models/project';
import { StatMode } from '../statistic-board-component/statistic-board-component';
import { OverviewFilter, StatFilterBarComponent } from '../../../core/shared/components/stat-filter-bar-component/stat-filter-bar-component';

@Component({
  selector: 'app-todo-overview',
  standalone: true,
  imports: [CommonModule, PercentPipe, StatFilterBarComponent],
  templateUrl: './todo-overview-component.html',
  styleUrl: './todo-overview-component.css'
})
export class TodoOverviewComponent {
  // 🚀 Signal-Inputs
  public privateTodos = input<Todo[]>([]);
  public teamTodos = input<Todo[]>([]);
  public myTeamTodos = input<Todo[]>([]);
  public myProjects = input<Project[]>([]);
  public mode = input<StatMode>('tasks');

  // Interne UI-Zustände
  protected activeFilter = signal<OverviewFilter>('all');
  protected isHorizontal = signal<boolean>(false);

  protected toggleRotation(): void {
    this.isHorizontal.update(v => !v);
  }

  protected setFilter(filter: OverviewFilter): void {
    console.log("setFilter", filter)
    this.activeFilter.set(filter);
  }

  // Einheit für die Anzeige
  protected get unit(): string {
    return this.mode() === 'tasks' ? '' : ' P';
  }

  // 🎯 Aktuelle Todos basierend auf Filter-Button
  protected displayedTodos = computed(() => {
    const filter = this.activeFilter();
    const privates = this.privateTodos();
    const teams = this.teamTodos();
    const myTeams = this.myTeamTodos();
    const projects = this.myProjects();

    switch (filter) {
      case 'private':
        return privates;
      case 'my-team':
        return myTeams;
      case 'team':
        return teams;
      case 'all':
        return [...privates, ...teams];
      default:
        const project = projects.find(p => p.id === filter);
        if (!project || !project.milestones) return [];
        const milestoneIds = project.milestones.map(m => m.id);
        return teams.filter(t => t.milestoneId && milestoneIds.includes(t.milestoneId));
    }
  });

  // Aufgeteilte Listen für deine getDisplayValue Logik
  protected openTodos = computed(() => this.displayedTodos().filter(t => !t.done));
  protected completedTodos = computed(() => this.displayedTodos().filter(t => t.done));
  protected overdueTodos = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // dueDate ist im Model ein Timestamp (number)
    return this.displayedTodos().filter(t => !t.done && t.dueDate && t.dueDate < today.getTime());
  });

  private sumEffort(todos: Todo[]): number {
    return todos.reduce((sum, t) => {
      const points = (t.done && t.usedEffort !== undefined && t.usedEffort !== null) 
        ? t.usedEffort 
        : (t.effort || 0);
      return sum + points;
    }, 0);
  }

  protected getDisplayValue(type: 'total' | 'open' | 'overdue' | 'completed'): number {
    if (this.mode() === 'tasks') {
      switch (type) {
        case 'total': return this.displayedTodos().length;
        case 'open': return this.openTodos().length;
        case 'overdue': return this.overdueTodos().length;
        case 'completed': return this.completedTodos().length;
      }
    } else {
      switch (type) {
        case 'total': return this.sumEffort(this.openTodos()) + this.sumEffort(this.completedTodos());
        case 'open': return this.sumEffort(this.openTodos());
        case 'overdue': return this.sumEffort(this.overdueTodos());
        case 'completed': return this.sumEffort(this.completedTodos());
      }
    }
  }

  protected get calculatedPercent(): number {
    const total = this.getDisplayValue('total');
    if (total === 0) return 0;
    return this.getDisplayValue('completed') / total;
  }

  private getPercentage(type: 'total' | 'open' | 'overdue' | 'completed'): number {
    const max = this.getDisplayValue('total');
    if (max === 0) return 0;
    return (this.getDisplayValue(type) / max) * 100;
  }

  // 🚀 ORIGINAL GITHUB BERECHNUNG (BEHEBT ANIMATIONSBUG PERFEKT)
  protected getBarWidth(type: 'total' | 'open' | 'overdue' | 'completed'): string {
    return this.isHorizontal() ? `${this.getPercentage(type)}%` : '100%';
  }

  protected getBarHeight(type: 'total' | 'open' | 'overdue' | 'completed'): string {
    return this.isHorizontal() ? '100%' : `${this.getPercentage(type)}%`;
  }
}