import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ConnectionService } from './connection-service';
import { ProjectRepository } from '../repositories/project-repository';
import { Project } from '../models/project';
import { Milestone } from '../models/milestone';

@Injectable({
  providedIn: 'root'
})
export class ProjectDataManagerService {
  private projectRepository = inject(ProjectRepository);
  private connectionService = inject(ConnectionService);

  private readonly STORAGE_KEY_PREFIX = 'local_projects_';

  private saveToLocalStorage(userId: string, projects: Project[]): void {
    localStorage.setItem(this.STORAGE_KEY_PREFIX + userId, JSON.stringify(projects));
  }

  private getFromLocalStorage(userId: string): Project[] {
    const data = localStorage.getItem(this.STORAGE_KEY_PREFIX + userId);
    if (!data) return [];

    const rawArray: any[] = JSON.parse(data);
    return rawArray.map(json => this.mapToFrontendProject(json));
  }

  public getProjects(userId: string): Observable<Project[]> {
    if (this.connectionService.isOffline()) {
      return of(this.getFromLocalStorage(userId));
    }

    return this.projectRepository.getProjectsByUserId(userId).pipe(
      map(backendProjects => {
        const liveProjects = backendProjects.map(bp => this.mapToFrontendProject(bp));
        this.saveToLocalStorage(userId, liveProjects);
        return liveProjects;
      }),
      catchError(err => {
        console.error('Fehler beim Online-Laden, weiche auf LocalStorage aus:', err);
        return of(this.getFromLocalStorage(userId));
      })
    );
  }

  public createProject(project: Project, userId: string): Observable<Project> {
    const body = this.mapToCreateDto(project, userId);

    if (this.connectionService.isOffline()) {
      const lokaleListe = this.getFromLocalStorage(userId);
      lokaleListe.push(project);
      this.saveToLocalStorage(userId, lokaleListe);
      return of(project);
    }

    return this.projectRepository.createProject(body).pipe(
      map(backendProject => {
        const saved = this.mapToFrontendProject(backendProject);
        const aktuelleListe = this.getFromLocalStorage(userId).filter(p => p.id !== project.id);
        aktuelleListe.push(saved);
        this.saveToLocalStorage(userId, aktuelleListe);
        return saved;
      })
    );
  }

  public updateProject(project: Project, userId: string): Observable<Project | undefined> {
    const body = this.mapToCreateDto(project, userId);

    if (this.connectionService.isOffline()) {
      const lokaleListe = this.getFromLocalStorage(userId);
      const index = lokaleListe.findIndex(p => p.id === project.id);
      if (index !== -1) {
        lokaleListe[index] = project;
        this.saveToLocalStorage(userId, lokaleListe);
      }
      return of(project);
    }

    if (project.id.startsWith('tmp_') || project.id.startsWith('OFFLINE')) {
      return of(project);
    }

    return this.projectRepository.updateProject(project.id, body).pipe(
      map(backendProject => {
        const updated = this.mapToFrontendProject(backendProject);
        const lokaleListe = this.getFromLocalStorage(userId).filter(p => p.id !== project.id);
        lokaleListe.push(updated);
        this.saveToLocalStorage(userId, lokaleListe);
        return updated;
      })
    );
  }

  public deleteProject(id: string, userId: string): Observable<void | undefined> {
    const lokaleListe = this.getFromLocalStorage(userId).filter(p => p.id !== id);
    this.saveToLocalStorage(userId, lokaleListe);

    if (id.startsWith('OFFLINE') || id.startsWith('tmp_')) {
      return of(undefined);
    }

    return this.projectRepository.deleteProject(id);
  }

  public synchronizeData(userId: string): Observable<Project[]> {
    const lokaleListe = this.getFromLocalStorage(userId);
    if (lokaleListe.length === 0) return of([]);

    return this.projectRepository.syncLocalProjects(userId, lokaleListe).pipe(
      map((serverJsonArray: any[]) => {
        const liveProjects = serverJsonArray.map((json: any) => this.mapToFrontendProject(json));
        this.saveToLocalStorage(userId, liveProjects);
        return liveProjects;
      }),
      catchError(err => {
        console.error('Bulk-Sync fehlgeschlagen.', err);
        return of(lokaleListe);
      })
    );
  }

  // ==========================================================================
  // 🔄 MAPPING-HELPER
  // ==========================================================================

  private mapToCreateDto(project: Project, userId: string) {
    return {
      userId: userId,
      ideaId: project.ideaId,
      title: project.title,
      area: project.area,
      content: project.content,
      status: project.status,
      milestones: (project.milestones || []).map(m => ({
        id: (m.id && m.id.startsWith('tmp_')) ? null : m.id,
        title: m.title,
        duration: m.duration,
        usedDuration: m.usedDuration || 0,
        status: m.status || 'Offen',
        assignedUserId: m.assignedUser?.id || null
      })),
      teamMemberIds: (project.teamMembers || []).map(member => member.id)
    };
  }

  private mapToFrontendProject(bp: any): Project {
    const frontendMilestones = (bp.fullMilestones || bp.milestones || []).map((bm: any) => {
      return new Milestone({
        id: bm.id,
        title: bm.title,
        duration: bm.duration,
        usedDuration: bm.usedDuration || 0,
        status: bm.status || 'Offen',
        assignedUser: bm.assignedUser || null
      });
    });

    return new Project({
      id: bp.id,
      ideaId: bp.ideaId,
      title: bp.title,
      area: bp.area,
      content: bp.content,
      status: bp.status,
      milestones: frontendMilestones,
      teamMembers: bp.teamMembers || []
    });
  }
}