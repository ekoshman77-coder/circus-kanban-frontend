import { inject, Injectable, signal, computed } from '@angular/core';
import { AdminProjectDataManagerService } from './admin-data-manager';
import { FilterService } from '../../filter/filter-service';
import { Project } from '../../../models/project';
import { ProjectStatus } from '../../../repositories/dto/project-json';

export type ProjectSortOption = 'title-asc' | 'title-desc' | 'status' | 'pm-name';

@Injectable({
    providedIn: 'root'
})
export class AdminProjectService {
    private adminDataManager = inject(AdminProjectDataManagerService);
    private filterService = inject(FilterService); // 🔗 Globale Suchleiste eingebunden!

    // 🏢 Lokaler UI-Filter für Abteilungen & Sortierung
    public selectedDepartmentId = signal<string>('ALL');
    public sortBy = signal<ProjectSortOption>('title-asc');

    constructor() {
        // Wenn die Komponente geladen wird, setzen wir die Globalsuche auf 'projects'
        this.filterService.setInitialCategory('projects');
    }

    // -------------------------------------------------------------------------
    // 🟢 REAKTIVE SIGNALS FÜR DIE UI
    // -------------------------------------------------------------------------

 /** 🟢 Aktive Projekte (status !== 'Zip' & nach Abteilung gefiltert) */
  public activeProjects = computed(() => {
    const all = this.adminDataManager.adminProjectsPool();
    const deptId = this.selectedDepartmentId();

    return all.filter(p => {
      const isNotZipped = p.status !== 'Zip';
      const matchesDept = deptId === 'ALL' || p.departmentId === deptId;
      return isNotZipped && matchesDept;
    });
  });

  /** 🗑️ Gezippte Projekte / Papierkorb (status === 'Zip' & nach Abteilung gefiltered) */
  public zippedProjects = computed(() => {
    const all = this.adminDataManager.adminProjectsPool();
    const deptId = this.selectedDepartmentId();

    return all.filter(p => {
      const isZipped = p.status === 'Zip';
      const matchesDept = deptId === 'ALL' || p.departmentId === deptId;
      return isZipped && matchesDept;
    });
  });

  /** 📊 Statistik für den Header */
  public projectStats = computed(() => {
    const all = this.adminDataManager.adminProjectsPool();
    return {
      totalActive: all.filter(p => p.status !== 'Zip').length,
      totalZipped: all.filter(p => p.status === 'Zip').length
    };
  });

    // -------------------------------------------------------------------------
    // 🛠️ HILFSMETHODE: FILTERUNG & SORTIERUNG
    // -------------------------------------------------------------------------

    private filterAndSortProjects(projects: Project[]): Project[] {
        // 1. Suchbegriff aus der globalen Header-Suchleiste holen
        const query = this.filterService.searchTerm().toLowerCase().trim();
        const deptId = this.selectedDepartmentId();
        const sort = this.sortBy();

        let result = projects;

        // 2. Department-Filter anwenden
        if (deptId !== 'ALL') {
            result = result.filter(p => p.departmentId === deptId);
        }

        // 3. Globale Volltextsuche (Titel, Bereich, Status)
        if (query) {
            result = result.filter(p =>
                p.title.toLowerCase().includes(query) ||
                p.area?.toLowerCase().includes(query) ||
                p.status.toLowerCase().includes(query)
            );
        }

        // 4. Sortierung
        return [...result].sort((a, b) => {
            switch (sort) {
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                case 'title-desc':
                    return b.title.localeCompare(a.title);
                case 'status':
                    return a.status.localeCompare(b.status);
                default:
                    return 0;
            }
        });
    }

    // -------------------------------------------------------------------------
    // 📝 PUBLIC ACTIONS
    // -------------------------------------------------------------------------

    public toggleProjectZipStatus(projectId: string, isZipped: boolean): void {
        this.adminDataManager.toggleProjectZipStatus(projectId, isZipped).subscribe();
    }

    /** 👑 Aktualisiert den Status eines Projekts im Admin-Board */
    public updateProjectStatus(project: Project, newStatus: ProjectStatus): void {
        this.adminDataManager.updateProjectStatus(project, newStatus);
    }
}