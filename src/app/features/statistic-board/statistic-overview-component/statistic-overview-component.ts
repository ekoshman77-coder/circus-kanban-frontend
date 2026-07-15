import { Component, inject, computed, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { Todo } from '../../../core/models/todo';
import { NoteService } from '../../../core/services/note-service';
import { ProjectService } from '../../../core/services/project-service';
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
  private todoQueryService = inject(TodoQueryService);
  public noteService = inject(NoteService);
  protected projectService = inject(ProjectService);
 
  mode = input.required<'tasks' | 'points'>();

  // 🎯 Das aktuell ausgewählte Projekt auf dem Dashboard
  protected selectedProjectId = signal<string | null>(null);

  // 👤 1. Mein persönlicher Fortschritt im ausgewählten Projekt
  protected personalProgress = computed(() => {
    const todos = this.todoService.todosSignal(); // Bereits dem User zugewiesene Aufgaben
    const activeProjectId = this.selectedProjectId();

    // Wenn kein Projekt gewählt ist, zeigen wir den Gesamtschnitt aller meiner Aufgaben
    if (!activeProjectId) {
      return todos.length === 0 ? 0 : this.tasksPercent(todos);
    }

    // Wir filtern meine Aufgaben lokal: Gehört die milestoneId des To-Dos zum aktiven Projekt?
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

    // Wenn kein Projekt gewählt ist, zeigen wir den Fortschritt über alle Team-Aufgaben
    if (!activeProjectId) {
      const allTeamTodos = this.todoService.teamTodos();
      return allTeamTodos.length === 0 ? 0 : this.tasksPercent(allTeamTodos);
    }

    // Wir holen alle Team-Aufgaben des Projekts direkt aus dem Query-Service!
    const projectTeamTodos = this.todoQueryService.getTodosForProject(activeProjectId);

    if (projectTeamTodos.length === 0) return 0;
    return this.tasksPercent(projectTeamTodos);
  });

  protected onProjectSelected(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  // 📐 Fortschritts-Rechner (Punkte vs. Aufgaben)
  private tasksPercent(todos: Todo[]): number {
    if (todos.length === 0) return 0;

    if (this.mode() === 'tasks') {
      const completed = todos.filter(t => t.done).length;
      return Math.round((completed / todos.length) * 100);
    } else {
      // Gesamtpunkte berechnen:
      // Für erledigte Aufgaben nehmen wir usedEffort (sofern eingetragen), sonst den geplanten effort.
      // Für offene Aufgaben nehmen wir den geplanten effort.
      const totalPoints = todos.reduce((sum, t) => {
        const p = (t.done && t.usedEffort !== undefined && t.usedEffort !== null) ? t.usedEffort : (t.effort || 0);
        return sum + p;
      }, 0);

      if (totalPoints === 0) return 0;

      // Erledigte Punkte berechnen (Nutzt usedEffort für ehrliche Werte!)
      const completedPoints = todos.filter(t => t.done).reduce((sum, t) => {
        const p = (t.usedEffort !== undefined && t.usedEffort !== null) ? t.usedEffort : (t.effort || 0);
        return sum + p;
      }, 0);

      return Math.round((completedPoints / totalPoints) * 100);
    }  
  }

  protected activeProjectsCount = computed(() => this.projectService.projectsList().length || 0);
  protected textLabel = computed(() => this.mode() === 'tasks' ? 'Erledigte Aufgaben' : 'Erledigte Punkte');
}