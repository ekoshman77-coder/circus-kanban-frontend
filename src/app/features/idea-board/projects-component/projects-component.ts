import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ProjectService } from '../../../core/services/project/project-service';
import { CommonModule } from '@angular/common';
import { TabNavigationService } from '../tab-navigation-service';
import { BoardTab } from '../tab-navigation-service';
import { Project } from '../../../core/models/project';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { ProjectStatsComponent } from '../project-stats-component/project-stats-component';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TeamService } from '../../../core/services/team/team-service';

/**
 * @component ProjectsComponent
 * @description 
 * Das Cockpit und die strategische Zentrale für alle aktiven Team-Projekte.
 * Verwaltet die Projektübersicht, filtert Projekte in Echtzeit über eine globale Suche,
 * prüft Benutzerberechtigungen für administrative Aktionen und steuert ein reaktives,
 * ausklappbares Statistik-Panel.
 */
@Component({
  selector: 'app-projects-component',
  standalone: true,
  imports: [CommonModule, UniversalPopupComponent, ProjectStatsComponent],
  templateUrl: './projects-component.html',
  styleUrl: './projects-component.css'
})
export class ProjectsComponent implements OnInit {
  // --- Services ---
  public readonly projectService = inject(ProjectService);
  public readonly todoService = inject(TodoService);
  private readonly tabService = inject(TabNavigationService);
  private readonly filterService = inject(FilterService);
  private readonly teamService = inject(TeamService);

  // --- UI-Zustände (Signals) ---
  /** Signal zur Steuerung der Sichtbarkeit des Lösch-Bestätigungs-Popups */
  public readonly showDeletePopup = signal<boolean>(false);
  
  /** Hält das aktuell zur Löschung ausgewählte Projekt */
  public readonly projectToDelete = signal<Project | null>(null);
  
  /** Steuert, ob das rechte System-Statistiken-Panel ausgefaltet ist */
  public readonly isStatsPanelOpen = signal<boolean>(false);

  // --- Reaktive Selektoren (Computed) ---
  /**
   * Filtert die geladenen Projekte in Echtzeit basierend auf dem globalen Suchbegriff.
   * Durchsucht Titel, Beschreibung (Content) und Projektbereich (Area).
   */
  public readonly projects = computed(() => {
    const list = this.projectService.projectsList();
    const query = this.filterService.searchTerm().toLowerCase().trim();
    
    if (!query) {
      return list;
    } 
    
    return list.filter(project => {
      const title = (project.title || '').toLowerCase();
      const content = (project.content || '').toLowerCase();
      const area = (project.area || '').toLowerCase();

      return title.includes(query) || content.includes(query) || area.includes(query);
    });   
  });

  /** Gesamtzahl aller Projekte aus den synchronisierten Dashboard-Statistiken */
  public readonly totalProjectsCount = computed(() => {
    return this.projectService.dashboardStats()?.totalProjects ?? 0;
  });

  /** Gesamtzahl aller Meilensteine über alle Projekte hinweg */
  public readonly totalMilestonesCount = computed(() => {
    return this.projectService.dashboardStats()?.totalMilestones ?? 0;
  });

  /** Gesamtzahl aller verknüpften Aufgaben (Todos) */
  public readonly totalTodosCount = computed(() => {
    return this.projectService.dashboardStats()?.totalTodos ?? 0;
  });

  /**
   * Initialisierungsschritt.
   * Setzt den initialen Filterfokus des globalen Such- und Filtersystems auf 'projects'.
   */
  public ngOnInit(): void {
    this.filterService.setInitialCategory('projects');
  }

  /**
   * Berechtigungsprüfung zum Löschen eines Projekts.
   * @param projectId Die ID des zu prüfenden Projekts.
   * @returns boolean - True, wenn der aktuelle User die Berechtigung besitzt.
   */
  public canDeleteProject(projectId: string): boolean {
    if (!projectId) {
      return false;
    }
    return this.teamService.hasPermission(projectId, 'PROJECT_DELETE');
  }

  /**
   * Schickt ein existierendes Projekt zurück in den Kalkulations-Workspace,
   * um Phasen, Budgets oder Aufwände neu zu berechnen.
   * @param project Das zu re-kalkulierende Projekt.
   */
  public openInCalculator(project: Project): void {
    console.log('🔄 Re-Kalkulation für Projekt initiiert:', project.title);
    this.tabService.changeTab(BoardTab.Calculator, {
      type: 'project',
      id: project.id
    });
  }

  /**
   * Öffnet das Lösch-Popup und setzt das zu löschende Projekt in den State.
   * @param project Das Projekt, das gelöscht werden soll.
   */
  public triggerDeletePopup(project: Project): void {
    this.projectToDelete.set(project);
    this.showDeletePopup.set(true);
  }

  /**
   * Schließt das Lösch-Popup und setzt den temporären Projekt-State zurück.
   */
  public closeDeletePopup(): void {
    this.showDeletePopup.set(false);
    this.projectToDelete.set(null);
  }

  /**
   * Bestätigt den Löschvorgang.
   * Entfernt das Projekt über den ProjectService unwiderruflich aus dem System.
   */
  public confirmDelete(): void {
    this.showDeletePopup.set(false);
    const project = this.projectToDelete();
    if (project && project.id) {
      console.log(`💥 Projekt-Einstampfen gestartet für: ${project.title}`);
      this.projectService.removeProject(project.id);
    }
  }

  /**
   * Wechselt zum Meilenstein-Tab und setzt den Fokus auf das ausgewählte Projekt.
   * @param project Das Zielprojekt für die Meilenstein-Verwaltung.
   */
  public openMilestones(project: Project): void {
    console.log('🎯 Navigiere zur Meilensteinverwaltung für:', project.title);
    this.tabService.changeTab(BoardTab.Milestones, {
      type: 'project',
      id: project.id
    });
  }

  /**
   * Springt direkt zu einer spezifischen Projektphase (Meilenstein).
   * @param milestoneId Die ID des Meilensteins.
   */
  public openSpecificMilestone(milestoneId: string): void {
    this.tabService.changeTab(BoardTab.Milestones, {
      type: 'milestone',
      id: milestoneId
    });
  }

  /**
   * Schaltet das Statistik-Panel (Drawer) an der rechten Bildschirmkante an oder aus.
   */
  public toggleStatsPanel(): void {
    this.isStatsPanelOpen.update(open => !open);
  }

  /**
   * Schließt das Statistik-Panel explizit.
   */
  public closeStatsPanel(): void {
    this.isStatsPanelOpen.set(false);
  }

  /**
   * Navigiert den Benutzer direkt zum Team-Kanban-Board des ausgewählten Projekts.
   * @param project Das Zielprojekt für das Board.
   */
  public openTeamBoard(project: Project): void {
    console.log('🎪 Direktsprung zum Team-Board für:', project.title);
    this.tabService.changeTab(BoardTab.team, {
      type: 'project',
      id: project.id
    });
  }
}