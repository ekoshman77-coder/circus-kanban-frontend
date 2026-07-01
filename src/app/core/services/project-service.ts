import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Project } from '../models/project';
import { ProjectDataManagerService } from './project-data-mananger-service';
import { UserService } from './user/user-service';
import { Milestone } from '../models/milestone';
import { TodoTeamStatus } from '../repositories/dto/milestone-json';
import { TodoViewModel } from '../viewmodel/todo-view-model';
import { TodoService } from './todo/todo-service';
import { Todo } from '../models/todo';
import { NoteService } from './note-service';
import { UnifiedSuggestion } from '../models/unified-suggestion';
import { MilestoneSuggestionsModel } from '../models/milestone-suggestions-model';
import { DraftProjectWrapper } from '../models/draft-project-wrapper';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private dataManager = inject(ProjectDataManagerService);
  private userService = inject(UserService);
  private noteService = inject(NoteService)

  // Das reaktive Speicherbecken für unseren unfertigen Entwurf
  private temporaryDraftSignal = signal<Project | null>(null);
  public readonly temporaryDraft = this.temporaryDraftSignal.asReadonly();

  private allProjectsPool = signal<Project[]>([]);

// Die korrigierte Lese-Brille im ProjectService:
  public readonly projectsList = computed(() => {
    const rawProjects = this.allProjectsPool();
    const currentUser = this.userService.currentUser();
    if (!currentUser) return [];

    const userProjects = rawProjects.filter(project => {
      // 1. Wenn du bereits im Team-Array bist:
      const isTeamMember = project.teamMembers?.some(m => m.id === currentUser.id);
      
      // 2. Fallback für frisch erstellte Projekte: Wenn das Team noch leer ist, 
      // gehört es dem Ersteller (also dir), damit es sofort sichtbar ist!
      const isBrandNew = !project.teamMembers || project.teamMembers.length === 0;

      // 3. Sicherheits-Check auf temporäre IDs (Offline/Berechnung)
      const isTemporary = project.id.startsWith('tmp_') || project.id.startsWith('OFFLINE');

      return isTeamMember || isBrandNew || isTemporary;
    });

    return userProjects.map(project => {
      if (project.milestones && project.milestones.length > 0) {
        project.milestones.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      }
      return project;
    });
  });
  
  private _aiSuggestionsSignal = signal<MilestoneSuggestionsModel | null>(null);
  public suggestions = computed(() => {
    const rawSuggestions = this._aiSuggestionsSignal();
    const currentProject = this.temporaryDraftSignal();
    const rejectedTitles = this.degradedMilestones(); // Deine Strafbank

    if (!rawSuggestions) return null;

    // 1. Welche Meilenstein-Titel sind bereits aktiv im Projekt?
    const activeTitles = currentProject?.milestones?.map(m => m.title) || [];

    // 2. Hilfsfunktion: Filtert eine Liste von Vorschlägen
    const filterList = (list: UnifiedSuggestion[]) => {
      return list.filter(suggestion => {
        // Der Vorschlag fliegt raus, wenn er SCHON AKTIV oder auf der STRAFBANK ist
        const isAlreadyActive = activeTitles.includes(suggestion.title);
        const isRejected = rejectedTitles.includes(suggestion.title);

        return !isAlreadyActive && !isRejected;
      });
    };

    // 3. Gib das gefilterte Modell an die UI weiter
    return {
      recommended: filterList(rawSuggestions.recommended),
      degraded: filterList(rawSuggestions.degraded)
    };
  });

  // liste degraded von user milestones
  private degradedMilestones = signal<string[]>([])
  public degradedMilestonesSignal = computed(() => this.degradedMilestones())

  private readonly STORAGE_KEY = 'pending_project_calculation';

  private _projectsSignal = signal<Project[]>([]);

  private todoService = inject(TodoService);

  // Das reaktive Fokus-Signal
  private activeMilestoneIdSignal = signal<string | null>(null);
  public readonly activeMilestoneId = this.activeMilestoneIdSignal.asReadonly();

  public setActiveMilestoneId(id: string | null) {
    this.activeMilestoneIdSignal.set(id);
  }

  /**
   * Die offizielle Schnittstelle, um den Entwurf sicher zu aktualisieren
   */
  public updateTemporaryDraft(project: Project | null): void {
    this.temporaryDraftSignal.set(project);
  }

  private get currentUserId(): string {
    const user = this.userService.currentUser();
    if (!user) throw new Error('Kein Benutzer angemeldet!');
    return user.id;
  }

  constructor() {
    // 🔄 DER AUTOMATISCHE WÄCHTER: Sichert jede Änderung im Entwurf sofort im LocalStorage
    effect(() => {
      const currentDraft = this.temporaryDraftSignal();
      // Wir sichern nur im LocalStorage, wenn es ein NEUER Entwurf ohne Datenbank-ID ist!
      if (currentDraft) {
        const wrapper: DraftProjectWrapper = { project: currentDraft, degradedMilestones: this.degradedMilestones() }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(wrapper));
      }
    });

effect(() => {
    const user = this.userService.currentUser();
    if (user) {
      this.loadProjects();
    } else {
      this.allProjectsPool.set([]); // <-- Geändert auf allProjectsPool!
    }
  });
  }

  /**
   * 🔍 REINES SCHAUFENSTER: Schaut auf die Festplatte, ob ein Entwurf da ist,
   * ohne das RAM-Signal zu belasten oder zu aktivieren!
   */
  public getSavedDraftTitle(): string | null {
    const savedRawData = localStorage.getItem(this.STORAGE_KEY);
    if (!savedRawData) return null;
    try {
      const parsed = JSON.parse(savedRawData);
      return parsed && parsed.project?.title ? parsed.project.title : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 🚑 DIE REANIMATION: Erst wenn der Nutzer aktiv "Ja" sagt,
   * laden wir die Daten wirklich in den Arbeitsspeicher (RAM)!
   */
  public restoreDraftFromStorage(): void {
    const savedRawData = localStorage.getItem(this.STORAGE_KEY);
    if (savedRawData) {
      try {
        const wrapper: DraftProjectWrapper = JSON.parse(savedRawData);
        if (wrapper.project) {
          this.temporaryDraftSignal.set(new Project(wrapper.project));
        }

        this.degradedMilestones.set(wrapper.degradedMilestones ?? [])
        console.log('🚑 [Service] Entwurf erfolgreich ins RAM geladen.');
      } catch (e) {
        this.clearTemporaryDraft();
      }
    }
  }

  /**
     * 🛡️ DAS INTELLIGENTE SCHUTZSCHILD (Fall 2 und Fall 4)
     * Prüft das Backup: Passt es zur ausgewählten Idee?
     */
  public initializeOrRestoreDraft(targetIdeaId: string, ideaTitle: string): void {
    const savedRawData = localStorage.getItem(this.STORAGE_KEY);

    if (savedRawData) {
      try {
        const wrapper: DraftProjectWrapper = JSON.parse(savedRawData);

        // 🎯 FALL 4: Stimmt die ideaId des Backups überein? -> Wiederbeleben!
        if (wrapper.project!.ideaId === targetIdeaId) {
          console.log('🚑 Fall 4: Passendes Backup gefunden! Zustand wird im RAM wiederbelebt.');

          if (wrapper.project) {
            this.temporaryDraftSignal.set(new Project(wrapper.project));
          }

          this.degradedMilestones.set(wrapper.degradedMilestones ?? [])
          return;
        } else {
          // 🎯 FALL 2: Es ist eine ANDERE Idee -> Altes Backup verwerfen!
          console.warn('⚠️ Fall 2: Altes Backup einer anderen Idee gefunden. Wird überschrieben!');
          this.clearTemporaryDraft();
        }
      } catch (e) {
        this.clearTemporaryDraft();
      }
    }

    const idee = this.noteService.notesList().find(idee => idee.id === targetIdeaId)

    // Wenn kein Backup da war oder es eine andere Idee war: Frisch starten!
    console.log('Starte frische Kalkulation für Idee:', ideaTitle);
    this.temporaryDraftSignal.set(new Project({
      ideaId: targetIdeaId,
      title: ideaTitle || '',
      milestones: [],
      area: idee?.tag ?? "Allgemein"
    }));
  }

  public clearTemporaryDraft(): void {
    this.temporaryDraftSignal.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
    this.degradedMilestones.set([]);
  }

  /**
   * LIVE-STATUS BERECHNUNG (On-The-Fly):
   * Nimmt die aktuellen To-Dos der Komponente und sagt blitzschnell,
   * welcher Status gilt. Keine Abhängigkeiten zwischen den Services!
   */
  public calculateMilestoneStatus(milestoneTodos: TodoViewModel[]): TodoTeamStatus {
    if (!milestoneTodos || milestoneTodos.length === 0) return 'Offen';

    // Wir prüfen auf das echte 'done' im Todo-Modell
    const allDone = milestoneTodos.every(vm => vm.todo.done);
    if (allDone) return 'Erledigt';

    const anyDone = milestoneTodos.some(vm => vm.todo.done);
    if (anyDone) return 'In Arbeit';

    return 'Offen';
  }

  /**
   * LIVE-FORTSCHRITT BERECHNUNG (On-The-Fly):
   */
  public calculateMilestoneProgress(milestoneTodos: TodoViewModel[]): number {
    if (!milestoneTodos || milestoneTodos.length === 0) return 0;

    const allPoints = milestoneTodos.reduce((sum, vm) => sum + vm.todo.effort, 0);
    if (allPoints === 0) return 0;

    const completedPoints = milestoneTodos
      .filter(vm => vm.todo.done)
      .reduce((sum, vm) => sum + vm.todo.effort, 0);

    return Math.round((completedPoints / allPoints) * 100);
  }

  // --- AB HIER BLEIBT DEIN CRUD-CODE ABSOLUT UNBERÜHRT UND STABIL ---
  public loadProjects(): void {
    try {
      // Aufruf ohne Parameter, da der DataManager jetzt autark arbeitet!
      this.dataManager.getProjects().subscribe({
        next: (projects) => this.allProjectsPool.set(projects), // <-- Schreibt direkt in den globalen Pool
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

    // Wir übergeben das aktualisierte Projekt und den kompletten allProjectsPool()
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

public saveCalculatedProject(project: Project): Observable<string> {
    // Wir übergeben das neue Projekt und den aktuellen Stand des Pools
    return this.dataManager.createProject(project, this.allProjectsPool()).pipe(
      tap((savedProject) => {
        this.allProjectsPool.update(projects => [...projects, savedProject]);

        // 🎯 HIER DIE BRÜCKE: Wenn das Projekt angelegt wurde, sperren wir die Idee!
        this.noteService.updateNoteStatus(project.ideaId, true);
      }),
      map((savedProject) => savedProject.id)
    );
  }

public updateCalculatedProject(updatedProject: Project): Observable<Project | undefined> {
    // Übergebe das modifizierte Projekt und den ungeschnittenen Pool
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
    // Dem DataManager die ID und den Zustand des Pools vor dem Löschen mitgeben
    this.dataManager.deleteProject(projectId, currentPool).subscribe();
  }

  public getProjectTodos(projectId: string | null) {
    if (!projectId) {
      return []
    }
    const project = this.projectsList().find((pr) => pr.id === projectId);

    if (!project || !project.milestones) {
      return []
    }

    const todos = project.milestones
      .reduce((result: Todo[], ms: Milestone) =>
        result.concat(this.todoService.getTodosForMilestone(ms.id))
        , [])
    return todos
  }


  /**
   * 📈 Meilenstein akzeptieren und über den DataManager tracken
   */
  public acceptSuggestion(projectTitle: string, milestoneTitle: string): void {
    // Sofort lokal aus dem Signal löschen für eine blitzschnelle UI
    const allSuggestions = [
      ...(this._aiSuggestionsSignal()?.recommended || []),
      ...(this._aiSuggestionsSignal()?.degraded || [])
    ]

    const milestone = allSuggestions.find(m => m.title === milestoneTitle)

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
      this.dataManager.trackMilestoneSelection(projectTitle, milestoneTitle, userId).subscribe();
    }
  }

  /**
   * 📉 Meilenstein ablehnen (Wegklicken) und über den DataManager tracken
   */
  public degradeSuggestion(projectTitle: string, milestoneTitle: string): void {
    // Sofort visuell aus beiden Listen kicken
    const allSuggestions = [
      ...(this._aiSuggestionsSignal()?.recommended || []),
      ...(this._aiSuggestionsSignal()?.degraded || [])
    ]
    const milestone = allSuggestions.find(m => m.title === milestoneTitle)
    this._aiSuggestionsSignal.update(model => {
      if (!model) return null;
      return {
        recommended: model.recommended.filter(s => s.title !== milestoneTitle),
        degraded: model.degraded.filter(s => s.title !== milestoneTitle)
      };
    });

    const userId = this.userService.getCurrentUserId();
    if (!userId || !milestone) return;

    this.degradedMilestones.set([...this.degradedMilestones(), milestoneTitle])

    if (milestone.source === 'KI') {
      this.dataManager.trackMilestoneDegradation(projectTitle, milestoneTitle, userId).subscribe();
    }
  }

  /**
   * sendet ignorierte milescones zur KI
   * @param projectTitle
   * @param userId 
   * @param milestoneTitles 
   */
  public ignoreSuggestions(projectTitle: string, allMilestoneswereShown: boolean) {
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      return
    }
    if (!this._aiSuggestionsSignal) {
      return
    }

    const visibleSuggestions = allMilestoneswereShown
      ? [...(this._aiSuggestionsSignal()?.recommended) ?? [],
      ...(this._aiSuggestionsSignal()?.degraded) ?? []]
      : this._aiSuggestionsSignal()?.recommended ?? []

    const titles = visibleSuggestions
      .filter(milestone => milestone.source === 'KI')
      .map(milestone => milestone.title)

    this.dataManager.trackMilestoneIgnorance(projectTitle, userId, titles).subscribe()
  }

  // public showMore() {
  //   this._showAll.set(true)
  // }

  // public showLess() {
  //   this._showAll.set(false)
  // }

  /**
   * ⚡ Lädt Vorschläge über die intelligente DataManager-Weiche
   */
  public loadMilestoneSuggestions(title: string, area: string): void {
    if (!title || title.trim().length < 3) {
      this._aiSuggestionsSignal.set({ recommended: [], degraded: [] });
      return;
    }
    const userId = this.userService.getCurrentUserId()
    if (!userId) {
      return
    }

    // Hier rufen wir jetzt den DataManager auf! (Nutzt das Signal mit Klammern: currentUserId())
    this.dataManager.getMilestoneSuggestions(title, area, userId).subscribe({
      next: (suggestions: MilestoneSuggestionsModel) => this._aiSuggestionsSignal.set(suggestions),
      error: (err) => console.error('Fehler beim Laden der Meilenstein-Vorschläge:', err)
    });
  }

  /**
   * Leert die KI-Vorschläge komplett (wird beim Speichern/Abbrechen aufgerufen)
   */
  public cleanSuggestions(): void {
    this._aiSuggestionsSignal.set({ recommended: [], degraded: [] });
  }
}