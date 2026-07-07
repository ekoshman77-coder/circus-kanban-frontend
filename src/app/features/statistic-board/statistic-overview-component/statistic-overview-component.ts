import { Component, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { Todo } from '../../../core/models/todo';
import { NoteService } from '../../../core/services/note-service';
import { ProjectService } from '../../../core/services/project-service';

@Component({
  selector: 'app-statistic-overview-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistic-overview-component.html',
  styleUrl: './statistic-overview-component.css'
})
export class StatisticOverviewComponent {
  private todoService = inject(TodoService);
  private noteService = inject(NoteService);
  private projectService = inject(ProjectService);
 
  // 🔄 Wir empfangen den Modus ('tasks' oder 'points') vom großen Steuer-Board
  mode = input.required<'tasks' | 'points'>();

  // 👤 1. Signal: Mein persönlicher Fortschritt (schaltet dynamisch um!)
  protected personalProgress = computed(() => {
    const todos = this.todoService.todosSignal(); // Hier müsstest du später noch filtern, welche To-Dos NUR DIR gehören!
    if (todos.length === 0) return 0;
    
    return this.tasksPercent(todos)
  });

  private tasksPercent(todos: Todo[]): number{
    if (this.mode() === 'tasks') {
      // Modus: Aufgaben zählen
      const completed = todos.filter(t => t.done).length;
      return Math.round((completed / todos.length) * 100);
    } else {
      // Modus: Story Points zählen
      const totalPoints = todos.reduce((sum, t) => sum + (t.effort || 0), 0);
      if (totalPoints === 0) return 0;
      const completedPoints = todos.filter(t => t.done).reduce((sum, t) => sum + (t.effort || 0), 0);
      return Math.round((completedPoints / totalPoints) * 100);
    }  
  }
  

  // 👥 2. Signal: Team-Fortschritt
  protected teamProgress = computed(() => {
    const todos = this.todoService.allTodos(); // Hier nimmst du wirklich die To-Dos des gesamten Teams
    if (todos.length === 0) return 0;

    return this.tasksPercent(todos)
  });


  // Dynamischer Text für die Karten-Beschreibung unter der Zahl
  protected textLabel = computed(() => {
    return this.mode() === 'tasks' ? 'der Aufgaben erledigt' : 'der Story Points erreicht';
  });

  protected activeProjectsCount = computed(() => this.projectService.projectsList().length);
  

  protected notesCount = computed(() => this.noteService.notesList().length);
}