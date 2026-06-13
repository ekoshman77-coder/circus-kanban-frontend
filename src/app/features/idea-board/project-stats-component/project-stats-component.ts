import { Component, computed, inject } from '@angular/core';
import { ProjectService } from '../../../core/services/project-service';
import { TodoService } from '../../../core/services/todo/todo-service';

@Component({
  selector: 'app-project-stats-component',
  imports: [],
  templateUrl: './project-stats-component.html',
  styleUrl: './project-stats-component.css',
})
export class ProjectStatsComponent {
  private projectService = inject(ProjectService);
  private todoService = inject(TodoService);

  // 🧮 Die reaktiven Berechnungen für die Kacheln
  public totalProjectsCount = computed(() => this.projectService.projectsList().length);
  public totalMilestonesCount = computed(() => this.projectService.projectsList().reduce((sum, proj) => sum + proj.milestones.length, 0));
  public totalTodosCount = computed(() => this.todoService.allTodos().length);
}
