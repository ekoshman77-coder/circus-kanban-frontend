import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Project } from '../../models/project';
import { ProjectDataManagerService } from './project-data-manager-service';
import { UserService } from '../user/user-service';
import { Milestone } from '../../models/milestone';
import { TodoTeamStatus } from '../../repositories/dto/milestone-json';
import { TodoViewModel } from '../../viewmodel/todo-view-model';
import { NoteService } from '../note/note-service';
import { UnifiedSuggestion } from '../../models/unified-suggestion';
import { MilestoneSuggestionsModel } from '../../models/milestone-suggestions-model';
import { NotificationService } from '../notification/notification-service';
import { ProjectDashboardStatsDTO } from '../../repositories/dto/project-dashboard-stats-dto';
import { ProjectDraftService } from './project-draft-service'; // <-- Neu importiert!
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

@Injectable({
  providedIn: 'root'
})
export class ProjectService extends BaseDataManager {

  private dataManager = inject(ProjectDataManagerService);
  private userService = inject(UserService);
  private noteService = inject(NoteService);
  private notificationService = inject(NotificationService);
  private draftService = inject(ProjectDraftService); // <-- Hier injiziert!

  private allProjectsPool = signal<Project[]>([]);
  // 👁️ Merkt sich, ob die "Strafbank" (der Keller) in dieser Session geöffnet wurde
  private degradedWereShownSignal = signal<boolean>(false);

  public setDegradedWereShown(): void {
    this.degradedWereShownSignal.set(true);
  }

  private dashboardStatsSignal = signal<ProjectDashboardStatsDTO | null>(null);
  public readonly dashboardStats = this.dashboardStatsSignal.asReadonly();
  
  public readonly projectsList = computed(() => {
    const rawProjects = this.allProjectsPool();
    const currentUser = this.userService.currentUser();
    if (!currentUser) return [];
    return rawProjects;
  });

  private degradedMilestones = signal<string[]>([]);
  public degradedMilestonesSignal = computed(() => this.degradedMilestones());

  private activeMilestoneIdSignal = signal<string | null>(null);
  public readonly activeMilestoneId = this.activeMilestoneIdSignal.asReadonly();

  private _aiSuggestionsSignal = signal<MilestoneSuggestionsModel | null>(null);

  // Die gefilterte Lesebrille für KI-Vorschläge
  public suggestions = computed(() => {
    const rawSuggestions = this._aiSuggestionsSignal();
    const currentProject = this.draftService.currentDraft(); // ✨ Greift jetzt auf den neuen DraftService zu!
    const rejectedTitles = this.degradedMilestones();

    if (!rawSuggestions) return null;

    const activeTitles = currentProject?.milestones?.map(m => m.title) || [];

    const filterList = (list: UnifiedSuggestion[]) => {
      return list.filter(suggestion => {
        const isAlreadyActive = activeTitles.includes(suggestion.title);
        const isRejected = rejectedTitles.includes(suggestion.title);
        return !isAlreadyActive && !isRejected;
      });
    };

    return {
      recommended: filterList(rawSuggestions.recommended),
      degraded: filterList(rawSuggestions.degraded)
    };
  });

  public setActiveMilestoneId(id: string | null) {
    this.activeMilestoneIdSignal.set(id);
  }

  constructor() {
    super()
    effect(() => {
      const user = this.userService.currentUser();
      if (user) {
        this.loadProjects();
      } else {
        this.allProjectsPool.set([]);
      }
    });
  }

  public getProjectIdByMilestoneId(milestoneId: string | null): string | null {
    if (!milestoneId) return null;

    const foundProject = this.allProjectsPool().find(project =>
      project.milestones?.some(ms => ms.id === milestoneId)
    );

    return foundProject ? foundProject.id : null;
  }

  public calculateMilestoneStatus(milestoneTodos: TodoViewModel[]): TodoTeamStatus {
    if (!milestoneTodos || milestoneTodos.length === 0) return 'Offen';

    const allDone = milestoneTodos.every(vm => vm.todo.done);
    if (allDone) return 'Erledigt';

    const anyDone = milestoneTodos.some(vm => vm.todo.done);
    if (anyDone) return 'In Arbeit';

    return 'Offen';
  }

  public calculateMilestoneProgress(milestoneTodos: TodoViewModel[]): number {
    if (!milestoneTodos || milestoneTodos.length === 0) return 0;

    const allPoints = milestoneTodos.reduce((sum, vm) => sum + vm.todo.effort, 0);
    if (allPoints === 0) return 0;

    const completedPoints = milestoneTodos
      .filter(vm => vm.todo.done)
      .reduce((sum, vm) => sum + vm.todo.effort, 0);

    return Math.round((completedPoints / allPoints) * 100);
  }

  public loadProjects(): void {
    try {
      this.dataManager.getProjects(this.userService.getCurrentUserId()?? "").subscribe({
        next: (projects) => this.allProjectsPool.set(projects),
        error: (err) => console.error('Fehler beim Laden der Projekte:', err)
      });
    } catch (e) {
      console.warn('Projekte konnten nicht geladen werden.');
    }
  }

  public updateMilestoneInProject(projectId: string, updatedMilestone: Milestone): Observable<boolean> {
    const currentProject = this.allProjectsPool().find(p => p.id === projectId);
    if (!currentProject) return of(false);

    const updatedMilestones = currentProject.milestones.map(ms =>
      ms.id === updatedMilestone.id ? updatedMilestone : ms
    );

    const updatedProject = new Project({ ...currentProject, milestones: updatedMilestones });

    return this.dataManager.updateProject(updatedProject, this.allProjectsPool()).pipe(
      tap(() => {
        this.allProjectsPool.update(projects =>
          projects.map(p => p.id === projectId ? updatedProject : p)
        );
      }),
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Speichert das fertig berechnete Projekt ab.
   */
  public saveCalculatedProject(project: Project): Observable<Project> {
    project.userId = this.userService.getCurrentUserId() ?? "";
    this.noteService.updateNoteStatus(project.ideaId, true);
    this.ignoreSuggestions(project.title, project.area, this.degradedWereShownSignal())
    
    return this.dataManager.createProject(project, this.allProjectsPool()).pipe(
      tap((savedProject) => {
        this.allProjectsPool.update(projects => [...projects, savedProject]);
        this.noteService.updateNoteStatus(project.ideaId, true);
      })
    );
  }

  /**
   * Aktualisiert ein bestehendes Projekt (für den Edit-Mode)
   */
  public updateCalculatedProject(updatedProject: Project): Observable<Project | undefined> {
   this.ignoreSuggestions(updatedProject.title, updatedProject.area, this.degradedWereShownSignal())

    return this.dataManager.updateProject(updatedProject, this.allProjectsPool()).pipe(
      tap(() => {
        this.allProjectsPool.update(projects =>
          projects.map(p => p.id === updatedProject.id ? updatedProject : p)
        );
      })
    );
  }

  public removeProject(projectId: string): void {
    const currentPool = this.allProjectsPool();
    this.allProjectsPool.update(projects => projects.filter(p => p.id !== projectId));
    this.dataManager.deleteProject(projectId, currentPool).subscribe();
  }

  // ==========================================
  // KI-VORSCHLÄGE & ANALYTICS INTERFACES
  // ==========================================

  public acceptSuggestion(projectTitle: string, projectArea: string, milestoneTitle: string): void {
    const allSuggestions = [
      ...(this._aiSuggestionsSignal()?.recommended || []),
      ...(this._aiSuggestionsSignal()?.degraded || [])
    ];

    const milestone = allSuggestions.find(m => m.title === milestoneTitle);

    this._aiSuggestionsSignal.update(model => {
      if (!model) return null;
      return {
        recommended: model.recommended.filter(s => s.title !== milestoneTitle),
        degraded: model.degraded.filter(s => s.title !== milestoneTitle)
      };
    });

    const userId = this.userService.getCurrentUserId();
    if (!userId || !milestone) return;

    if (milestone.source === 'KI') {
      this.dataManager.trackMilestoneSelection(projectTitle, projectArea, milestoneTitle, userId).subscribe();
    }
  }

  public degradeSuggestion(projectTitle: string, projectArea: string, milestoneTitle: string): void {
    const allSuggestions = [
      ...(this._aiSuggestionsSignal()?.recommended || []),
      ...(this._aiSuggestionsSignal()?.degraded || [])
    ];
    const milestone = allSuggestions.find(m => m.title === milestoneTitle);
    
    this._aiSuggestionsSignal.update(model => {
      if (!model) return null;
      return {
        recommended: model.recommended.filter(s => s.title !== milestoneTitle),
        degraded: model.degraded.filter(s => s.title !== milestoneTitle)
      };
    });

    const userId = this.userService.getCurrentUserId();
    if (!userId || !milestone) return;

    this.degradedMilestones.set([...this.degradedMilestones(), milestoneTitle]);

    if (milestone.source === 'KI') {
      this.dataManager.trackMilestoneDegradation(projectTitle, projectArea, milestoneTitle, userId).subscribe();
    }
  }

  public ignoreSuggestions(projectTitle: string, projectArea: string, allMilestoneswereShown: boolean) {
    const userId = this.userService.getCurrentUserId();
    if (!userId || !this._aiSuggestionsSignal) return;

    const visibleSuggestions = allMilestoneswereShown
      ? [...(this._aiSuggestionsSignal()?.recommended) ?? [], ...(this._aiSuggestionsSignal()?.degraded) ?? []]
      : this._aiSuggestionsSignal()?.recommended ?? [];

    const titles = visibleSuggestions
      .filter(milestone => milestone.source === 'KI')
      .map(milestone => milestone.title);

    this.dataManager.trackMilestoneIgnorance(projectTitle, projectArea, userId, titles).subscribe();
  }

  public loadMilestoneSuggestions(title: string, area: string): void {
    if (!title || title.trim().length < 3) {
      this._aiSuggestionsSignal.set({ recommended: [], degraded: [] });
      return;
    }

    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.dataManager.getMilestoneSuggestions(title, area, userId).subscribe({
      next: (suggestions: MilestoneSuggestionsModel) => {
        this._aiSuggestionsSignal.set(suggestions);
      },
      error: (err) => console.error('Fehler beim Laden der KI-Vorschläge:', err)
    });
  }

  public loadDashboardStatistics(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.dataManager.getDashboardStatistics(userId).subscribe({
      next: (stats) => this.dashboardStatsSignal.set(stats),
      error: (err: Error) => {
        this.dashboardStatsSignal.set(null);
        if (err.message === 'OFFLINE_MODE') {
          this.notificationService.showNotification(
            'Globale Statistiken sind im Offline-Modus nicht verfügbar. 🔌',
            'info'
          ); 
        } else {
          this.notificationService.showNotification(
            'Fehler beim Laden der Dashboard-Statistiken.',
            'error'
          ); 
        }
      }
    });
  }

  public cleanSuggestions(): void {
    this._aiSuggestionsSignal.set({ recommended: [], degraded: [] });
    this.degradedMilestones.set([]);          
    this.degradedWereShownSignal.set(false);  
  }

public override resetData(): void {
    this.allProjectsPool.set([]);
    this.dashboardStatsSignal.set(null);
    this.degradedMilestones.set([]);
    this.activeMilestoneIdSignal.set(null);
    this.cleanSuggestions();
  }
}