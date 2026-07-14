import { Component, inject, computed, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { Todo } from '../../../core/models/todo';
import { NoteService } from '../../../core/services/note-service';
import { ProjectService } from '../../../core/services/project-service';
// 🌟 NEU: Importiere deinen genialen Query-Service!
import { TodoQueryService } from '../../../core/services/todo-query-service'; 
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-statistic-overview-component',
  standalone: true,
  imports: [CommonModule, MilestoneSelectorComponent],
  templateUrl: './statistic-overview-component.html',
  styleUrl: './statistic-overview-component.css'
})
export class StatisticOverviewComponent {
  private todoService = inject(TodoService);
  private todoQueryService = inject(TodoQueryService); // 🌟 Hier injiziert!
  public noteService = inject(NoteService);
  protected projectService = inject(ProjectService);
 
  mode = input.required<'tasks' | 'points'>();

  // 🎯 Das aktuell ausgewählte Projekt auf dem Dashboard
  protected selectedProjectId = signal<string | null>(null);

  // 👤 1. Mein persönlicher Fortschritt im ausgewählten Projekt
  protected personalProgress = computed(() => {
    const todos = this.todoService.todosSignal(); // Dem User zugewiesene Aufgaben
    const activeProjectId = this.selectedProjectId();

    // Wenn kein Projekt gewählt ist, zeigen wir den Gesamtschnitt aller meiner Aufgaben
    if (!activeProjectId) {
      return todos.length === 0 ? 0 : this.tasksPercent(todos);
    }

    // 🌟 Wir filtern meine Aufgaben lokal: Gehört die milestoneId des To-Dos zum aktiven Projekt?
    const myProjectTodos = todos.filter(t => {
      const projId = this.todoQueryService.getProjectIdByMilestoneId(t.milestoneId);
      return projId === activeProjectId;
    });
    
    if (myProjectTodos.length === 0) return 0;
    return this.tasksPercent(myProjectTodos);
  });

  // 👥 2. Team Sprint-Fortschritt im ausgewählten Projekt
  protected teamProgress = computed(() => {
    const activeProjectId = this.selectedProjectId();

    // Wenn kein Projekt gewählt ist, zeigen wir 0% oder nutzen alle Team-Aufgaben
    if (!activeProjectId) {
      const allTeamTodos = this.todoService.teamTodos();
      return allTeamTodos.length === 0 ? 0 : this.tasksPercent(allTeamTodos);
    }

    // 🌟 SENSATIONELL EINFACH: Wir holen alle Team-Aufgaben des Projekts direkt aus dem Query-Service!
    const projectTeamTodos = this.todoQueryService.getTodosForProject(activeProjectId);

    if (projectTeamTodos.length === 0) return 0;
    return this.tasksPercent(projectTeamTodos);
  });

  protected onProjectSelected(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  private tasksPercent(todos: Todo[]): number {
    if (this.mode() === 'tasks') {
      const completed = todos.filter(t => t.done).length;
      return Math.round((completed / todos.length) * 100);
    } else {
      const totalPoints = todos.reduce((sum, t) => sum + (t.effort || 0), 0);
      if (totalPoints === 0) return 0;
      const completedPoints = todos.filter(t => t.done).reduce((sum, t) => sum + (t.effort || 0), 0);
      return Math.round((completedPoints / totalPoints) * 100);
    }  
  }

  protected activeProjectsCount = computed(() => this.projectService.projectsList().length || 0);
  protected textLabel = computed(() => this.mode() === 'tasks' ? 'Erledigte Aufgaben' : 'Erledigte Punkte');
}