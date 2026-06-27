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

  private _aiSuggestionsSignal = signal<MilestoneSuggestionsModel | null>(null);

  private _showAll = signal<boolean>(false)
  public showAll = computed(() => this._showAll())

  // 🕶️ Die Component holt sich hieraus blind die empfohlenen Meilensteine
  public readonly recommendedSuggestions = computed(() => {
    const model = this._aiSuggestionsSignal();
    if (!model) {
      return []
    }
    return this._showAll()
        ? [ ...model.recommended, ...model.degraded]
        : model.recommended
  });

  // Signal-Typ anpassen auf unser neues, einheitliches Modell
//  public readonly aiSuggestions = this._aiSuggestionsSignal.asReadonly();
  private readonly STORAGE_KEY = 'pending_project_calculation';

  private _projectsSignal = signal<Project[]>([]);

  // 🕶️ 2. Die öffentliche Lese-Brille sortiert die Meilensteine vollautomatisch!
  public readonly projectsList = computed(() => {
    const rawProjects = this._projectsSignal();

    return rawProjects.map(project => {
      if (project.milestones && project.milestones.length > 0) {
        // 🔄 Wir sortieren die Meilensteine direkt im Flug nach orderIndex!
        project.milestones.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      }
      return project;
    });
  });

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
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentDraft));
      }
    });

    effect(() => {
      const user = this.userService.currentUser();
      if (user) {
        this.loadProjects();
      } else {
        this._projectsSignal.set([]);
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
      return parsed && parsed.title ? parsed.title : null;
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
        this.temporaryDraftSignal.set(new Project(JSON.parse(savedRawData)));
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
        const parsed = JSON.parse(savedRawData);

        // 🎯 FALL 4: Stimmt die ideaId des Backups überein? -> Wiederbeleben!
        if (parsed.ideaId === targetIdeaId) {
          console.log('🚑 Fall 4: Passendes Backup gefunden! Zustand wird im RAM wiederbelebt.');
          this.temporaryDraftSignal.set(new Project(parsed));
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
      this.dataManager.getProjects(this.currentUserId).subscribe({
        next: (projects) => this._projectsSignal.set(projects),
        error: (err) => console.error('Fehler beim Laden der Projekte:', err)
      });
    } catch (e) {
      console.warn('Projekte konnten nicht geladen werden.');
    }
  }

  public updateMilestoneInProject(projectId: string, updatedMilestone: Milestone): Observable<boolean> {
    const currentProject = this._projectsSignal().find(p => p.id === projectId);
    if (!currentProject) return of(false);

    const updatedMilestones = currentProject.milestones.map(ms =>
      ms.id === updatedMilestone.id ? updatedMilestone : ms
    );

    const updatedProject = new Project({ ...currentProject, milestones: updatedMilestones });

    return this.dataManager.updateProject(updatedProject, this.currentUserId).pipe(
      tap(() => {
        this._projectsSignal.update(projects =>
          projects.map(p => p.id === projectId ? updatedProject : p)
        );
      }),
      map(() => true),
      catchError(() => of(false))
    );
  }

  public saveCalculatedProject(project: Project): Observable<string> {
    return this.dataManager.createProject(project, this.currentUserId).pipe(
      tap((savedProject) => {
        this._projectsSignal.update(projects => [...projects, savedProject]);

        // 🎯 HIER DIE BRÜCKE: Wenn das Projekt angelegt wurde, sperren wir die Idee!
        this.noteService.updateNoteStatus(project.ideaId, true);
      }),
      map((savedProject) => savedProject.id)
    );
  }

  public updateCalculatedProject(updatedProject: Project): Observable<Project | undefined> {
    return this.dataManager.updateProject(updatedProject, this.currentUserId).pipe(
      tap(() => {
        this._projectsSignal.update(projects =>
          projects.map(p => p.id === updatedProject.id ? updatedProject : p)
        );
      })
    );
  }

  public removeProject(projectId: string): void {
    this._projectsSignal.update(projects => projects.filter(p => p.id !== projectId));
    this.dataManager.deleteProject(projectId, this.currentUserId).subscribe();
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
  public ignoreSuggestions(projectTitle: string) {
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      return
    }

    const titles = this.recommendedSuggestions()
                          .filter(milestone => milestone.source === 'KI')
                          .map(milestone => milestone.title)

    this.dataManager.trackMilestoneIgnorance(projectTitle, userId, titles).subscribe()
  }

  public showMore() {
    this._showAll.set(true)
  }

  public showLess() {
    this._showAll.set(false)
  }

  /**
   * ⚡ Lädt Vorschläge über die intelligente DataManager-Weiche
   */
  public loadMilestoneSuggestions(title: string, area: string): void {
    if (!title || title.trim().length < 3) {
      this._aiSuggestionsSignal.set({recommended: [], degraded: []});
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