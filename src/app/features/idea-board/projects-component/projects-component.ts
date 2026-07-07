import { Component, computed, inject, signal } from '@angular/core';
import { ProjectService } from '../../../core/services/project-service';
import { CommonModule } from '@angular/common';
import { TabNavigationService } from '../tab-navigation-service';
import { BoardTab } from '../tab-navigation-service';
import { Project } from '../../../core/models/project';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { ProjectStatsComponent } from '../project-stats-component/project-stats-component';
import { FilterService } from '../../../core/services/filter-service';
import { TeamService } from '../../../core/services/team-service';

@Component({
  selector: 'app-projects-component',
  standalone: true,
  imports: [CommonModule, UniversalPopupComponent, ProjectStatsComponent],
  templateUrl: './projects-component.html',
  styleUrl: './projects-component.css'
})
export class ProjectsComponent {
  // 🏗️ Wir holen uns die Projekte und die Navigation
  public projectService = inject(ProjectService);
  private tabService = inject(TabNavigationService);
  public todoService = inject(TodoService)
  private filterService = inject(FilterService)
  private teamService = inject(TeamService)

  public showDeletePopup = signal<boolean>(false);
  public projectToDelete = signal<Project | null>(null)
  // 🚀 Ein neues Signal, um zu steuern, ob das Statistik-Panel offen ist
  public isStatsPanelOpen = signal<boolean>(false);

  // Reaktiver Zugriff auf die geladenen Projekte aus dem Service
  public projects = computed(() => {
    const list =  this.projectService.projectsList();
    const query = this.filterService.searchTerm().toLowerCase().trim();
    if (!query) {
      return list
    } 
    return list.filter(project => {
      const title = (project.title || '').toLowerCase();
      const content = (project.content || '').toLowerCase();
      const area = (project.area || '').toLowerCase();

      return title.includes(query) || content.includes(query) || area.includes(query);
    });   
  });

  /**
   * 📊 STATISTIK 1: Anzahl aller strategischen Projekte
   */
  public totalProjectsCount = computed(() => this.projects().length);

  /**
   * 📊 STATISTIK 2: Summe aller Meilensteine über alle Projekte hinweg
   */
  public totalMilestonesCount = computed(() => {
    return this.projects().reduce((sum, proj) => sum + proj.milestones.length, 0);
  });

  /**
   * 📊 STATISTIK 3: Anzahl aller To-Dos im gesamten System
   */
  public totalTodosCount = computed(() => this.todoService.allTodos().length);


  ngOnInit(): void {
    this.filterService.setInitialCategory('projects');
  }

  public canDeleteProject(projectId: string): boolean {
    if (!projectId) {
      return false
    }
    console.log("check permission to delete")
    const hasPermission = this.teamService.hasPermission(projectId, 'PROJECT_DELETE')
    return hasPermission
//    return 
  }

  /**
   * RE-KALKULATION STARTEN:
   * Schnappt sich ein bestehendes Projekt und schickt es zurück in den Kalkulator.
   */
  public openInCalculator(project: Project): void {
    console.log('🔄 Schicke bestehendes Projekt in die Re-Kalkulation:', project.title);

    // Wir übergeben den Typ 'project' und die echte ID!
    this.tabService.changeTab(BoardTab.Calculator, {
      type: 'project',
      id: project.id
    });
  }

  public triggerDeletePopup(project: Project) {
    this.projectToDelete.set(project)
    this.showDeletePopup.set(true);
  }

  public closeDeletePopup() {
    this.showDeletePopup.set(false)
    this.projectToDelete.set(null)
  }

  public confirmDelete() {
    this.showDeletePopup.set(false)
    const project = this.projectToDelete()
    if (project && project.id) {
      console.log(`💥 Einstampfen läuft für: ${project.title}`);
      this.projectService.removeProject(project.id)
    }
  }

  public openMilestones(project: Project): void {
    console.log('🎯 Navigiere zu den Meilensteinen für:', project.title);

    // Wir wechseln zum neuen Tab und übergeben den State, genau wie beim Kalkulator!
    this.tabService.changeTab(BoardTab.Milestones, {
      type: 'project',
      id: project.id
    });
  }

  public openSpecificMilestone(milestoneId: string): void {
    this.tabService.changeTab(BoardTab.Milestones, {
      type: 'milestone',
      id: milestoneId
    });
  }

  // Zwei kleine Methoden zum Umschalten
  public toggleStatsPanel(): void {
    this.isStatsPanelOpen.update(open => !open);
  }

  public closeStatsPanel(): void {
    this.isStatsPanelOpen.set(false);
  }

  public openTeamBoard(project: Project): void {
    console.log('🎪 Navigiere direkt zum Team-Board für Projekt:', project.title);

    // Wir wechseln zum Team-Board-Tab und übergeben den Zustand als 'project'!
    this.tabService.changeTab(BoardTab.team, {
      type: 'project',
      id: project.id
    });
  }
}