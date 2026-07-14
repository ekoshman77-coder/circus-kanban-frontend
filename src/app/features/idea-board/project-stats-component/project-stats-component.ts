import { Component, computed, inject, OnInit } from '@angular/core';
import { ProjectService } from '../../../core/services/project-service';

@Component({
  selector: 'app-project-stats-component',
  standalone: true, // Stelle sicher, dass standalone aktiv ist, falls du es nutzt
  imports: [],
  templateUrl: './project-stats-component.html',
  styleUrl: './project-stats-component.css',
})
export class ProjectStatsComponent implements OnInit {
  private projectService = inject(ProjectService);

  // 1. Beim Initialisieren der Komponente stoßen wir den API-Request an
  ngOnInit(): void {
    this.projectService.loadDashboardStatistics();
  }

  // 2. 🧮 Die Kacheln lesen jetzt reaktiv das DTO aus dem Service!
  // Wir nutzen einen sicheren Fallback (?? 0), falls die Statistik null/offline ist.
  public totalProjectsCount = computed(() => {
    return this.projectService.dashboardStats()?.totalProjects ?? 0;
  });

  public totalMilestonesCount = computed(() => {
    return this.projectService.dashboardStats()?.totalMilestones ?? 0;
  });

  public totalTodosCount = computed(() => {
    return this.projectService.dashboardStats()?.totalTodos ?? 0;
  });
}