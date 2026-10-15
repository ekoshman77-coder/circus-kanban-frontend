import { Component, inject, computed, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { Todo } from '../../../core/models/todo';
import { NoteService } from '../../../core/services/note/note-service';
import { ProjectService } from '../../../core/services/project/project-service';
import { TodoQueryService } from '../../../core/services/todo/todo-query-service'; 
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { OverviewFilter, StatFilterBarComponent } from '../../../core/shared/components/stat-filter-bar-component/stat-filter-bar-component';
import { Project } from '../../../core/models/project';

@Component({
  selector: 'app-statistic-overview-component',
  standalone: true,
  imports: [CommonModule, StatFilterBarComponent],
  templateUrl: './statistic-overview-component.html',
  styleUrl: './statistic-overview-component.css'
})
// statistic-overview-component.ts

export class StatisticOverviewComponent {
  private todoQueryService = inject(TodoQueryService);
  public noteService = inject(NoteService);
  protected projectService = inject(ProjectService);
 
  mode = input.required<'tasks' | 'points'>();
  public myProjects = input<Project[]>([]);

  // 🚀 NEU: Zentrale Inputs aus der StatisticBoardComponent!
  public myTeamTodos = input<Todo[]>([]); // Das ist das neue userContributionTodos
  public teamTodos = input<Todo[]>([]);   // Alle Team-Todos für das Gesamtergebnis

  protected selectedProjectId = signal<string | null>(null);
  public activeFilter = signal<OverviewFilter>('all');

  // 👤 1. Mein persönlicher Fortschritt (Nutzt myTeamTodos / Beitrags-Todos)
  protected personalProgress = computed(() => {
    const todos = this.myTeamTodos(); // 💡 Beitrags-Liste statt nur todosSignal!
    const activeProjectId = this.selectedProjectId();

    if (!activeProjectId) {
      return todos.length === 0 ? 0 : this.tasksPercent(todos);
    }

    const myProjectTodos = todos.filter(t => {
      const projId = this.todoQueryService.getProjectIdByMilestoneId(t.milestoneId);
      return projId === activeProjectId;
    });
    
    if (myProjectTodos.length === 0) return 0;
    return this.tasksPercent(myProjectTodos);
  });

  // 👥 2. Team Sprint-Fortschritt (Nutzt das übergebene teamTodos Input)
  protected teamProgress = computed(() => {
    const activeProjectId = this.selectedProjectId();

    if (!activeProjectId) {
      const allTeamTodos = this.teamTodos(); // 💡 Nimmt jetzt das Input statt todoService!
      return allTeamTodos.length === 0 ? 0 : this.tasksPercent(allTeamTodos);
    }

    const projectTeamTodos = this.todoQueryService.getTodosForProject(activeProjectId);

    if (projectTeamTodos.length === 0) return 0;
    return this.tasksPercent(projectTeamTodos);
  });

  protected onFilterSelected(filter: OverviewFilter): void {
    this.activeFilter.set(filter);    
    this.selectedProjectId.set(this.activeFilter() !== 'all' ? this.activeFilter() : null);    
  }

  // 📐 tasksPercent() & activeProjectsCount bleiben unverändert!
  private tasksPercent(todos: Todo[]): number {
    if (todos.length === 0) return 0;

    if (this.mode() === 'tasks') {
      const completed = todos.filter(t => t.done || t.teamStatus === 'DONE').length;
      return Math.round((completed / todos.length) * 100);
    } else {
      const totalPoints = todos.reduce((sum, t) => {
        const p = ((t.done || t.teamStatus === 'DONE') && t.usedEffort !== undefined && t.usedEffort !== null) 
          ? t.usedEffort 
          : (t.effort || 0);
        return sum + p;
      }, 0);

      if (totalPoints === 0) return 0;

      const completedPoints = todos.filter(t => t.done || t.teamStatus === 'DONE').reduce((sum, t) => {
        const p = (t.usedEffort !== undefined && t.usedEffort !== null) ? t.usedEffort : (t.effort || 0);
        return sum + p;
      }, 0);

      return Math.round((completedPoints / totalPoints) * 100);
    }  
  }

  protected activeProjectsCount = computed(() => this.projectService.projectsList().length || 0);
  protected textLabel = computed(() => this.mode() === 'tasks' ? 'Erledigte Aufgaben' : 'Erledigte Punkte');
}