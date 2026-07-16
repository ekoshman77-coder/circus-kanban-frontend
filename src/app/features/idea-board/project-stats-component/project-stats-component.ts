import { Component, computed, inject, OnInit } from '@angular/core';
import { ProjectService } from '../../../core/services/project-service';

/**
 * @component ProjectStatsComponent
 * @description
 * Eine leichtgewichtige, reaktive Dashboard-Komponente, die strategische
 * System-Kennzahlen (Projekte, Meilensteine, Todos) visualisiert.
 * Nutzt Angular Signals (Computed), um Datenveränderungen ohne manuelles Change-Detection-Triggering
 * direkt aus dem ProjectService zu streamen.
 */
@Component({
  selector: 'app-project-stats-component',
  standalone: true,
  imports: [],
  templateUrl: './project-stats-component.html',
  styleUrl: './project-stats-component.css',
})
export class ProjectStatsComponent implements OnInit {
  /** Injektion des zentralen Daten-Repositorys */
  private readonly projectService = inject(ProjectService);

  /**
   * Lifecycle Hook.
   * Stößt beim Laden der Komponente den API-/Service-Request an,
   * um die neuesten Dashboard-Statistiken in den State zu laden.
   */
  public ngOnInit(): void {
    this.projectService.loadDashboardStatistics();
  }

  /**
   * @property totalProjectsCount
   * @description Reaktiver Zähler für die Anzahl aller aktiven Projekte.
   * Nutzt einen sicheren Fallback (0), falls der Service-State noch lädt oder offline ist.
   */
  public readonly totalProjectsCount = computed(() => {
    return this.projectService.dashboardStats()?.totalProjects ?? 0;
  });

  /**
   * @property totalMilestonesCount
   * @description Reaktiver Zähler für die Gesamtanzahl aller geplanten Projektphasen (Meilensteine).
   */
  public readonly totalMilestonesCount = computed(() => {
    return this.projectService.dashboardStats()?.totalMilestones ?? 0;
  });

  /**
   * @property totalTodosCount
   * @description Reaktiver Zähler für alle im System erfassten Aufgaben (Todos).
   */
  public readonly totalTodosCount = computed(() => {
    return this.projectService.dashboardStats()?.totalTodos ?? 0;
  });
}