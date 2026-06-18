import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Project } from '../models/project';
import { ProjectDataManagerService } from './project-data-mananger-service';
import { UserService } from './user/user-service';
import { Milestone } from '../models/milestone';
import { TodoTeamStatus } from '../repositories/dto/milestone-json';
import { TodoViewModel } from '../viewmodel/todo-view-model';
import { TodoService } from './todo/todo-service';
import { Todo } from '../models/todo';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private dataManager = inject(ProjectDataManagerService);
  private userService = inject(UserService);

  public projectsSignal = signal<Project[]>([]);
  public readonly projectsList = this.projectsSignal.asReadonly();

  private todoService = inject(TodoService);

// Das reaktive Fokus-Signal
private activeMilestoneIdSignal = signal<string | null>(null);
public readonly activeMilestoneId = this.activeMilestoneIdSignal.asReadonly();

public setActiveMilestoneId(id: string | null) {
  this.activeMilestoneIdSignal.set(id);
}

  private get currentUserId(): string {
    const user = this.userService.currentUser();
    if (!user) throw new Error('Kein Benutzer angemeldet!');
    return user.id;
  }

  constructor() {
    effect(() => {
      const user = this.userService.currentUser();
      if (user) {
        this.loadProjects();
      } else {
        this.projectsSignal.set([]);
      }
    });
  }

  /**
   * 🧮 LIVE-STATUS BERECHNUNG (On-The-Fly):
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
   * 📊 LIVE-FORTSCHRITT BERECHNUNG (On-The-Fly):
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
        next: (projects) => this.projectsSignal.set(projects),
        error: (err) => console.error('Fehler beim Laden der Projekte:', err)
      });
    } catch (e) {
      console.warn('Projekte konnten nicht geladen werden.');
    }
  }

  public updateMilestoneInProject(projectId: string, updatedMilestone: Milestone): Observable<boolean> {
    const currentProject = this.projectsSignal().find(p => p.id === projectId);
    if (!currentProject) return of(false);

    const updatedMilestones = currentProject.milestones.map(ms => 
      ms.id === updatedMilestone.id ? updatedMilestone : ms
    );

    const updatedProject = new Project({ ...currentProject, milestones: updatedMilestones });

    return this.dataManager.updateProject(updatedProject, this.currentUserId).pipe(
      tap(() => {
        this.projectsSignal.update(projects =>
          projects.map(p => p.id === projectId ? updatedProject : p)
        );
      }),
      map(() => true),
      catchError(() => of(false))
    );
  }

  public saveCalculatedProject(project: Project): Observable<string> {
    return this.dataManager.createProject(project, this.currentUserId).pipe(
      tap((savedProject) => this.projectsSignal.update(projects => [...projects, savedProject])),
      map((savedProject) => savedProject.id)
    );
  }

  public updateCalculatedProject(updatedProject: Project): Observable<Project | undefined> {
    return this.dataManager.updateProject(updatedProject, this.currentUserId).pipe(
      tap(() => {
        this.projectsSignal.update(projects =>
          projects.map(p => p.id === updatedProject.id ? updatedProject : p)
        );
      })
    );
  }
  
  public removeProject(projectId: string): void {
    this.projectsSignal.update(projects => projects.filter(p => p.id !== projectId));
    this.dataManager.deleteProject(projectId, this.currentUserId).subscribe();
  }

  public getProjectTodos(projectId: string | null) {
    if (!projectId) {
      return[]
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
}