import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ProjectRepository } from '../../repositories/project-repository';
import { Project } from '../../models/project';
import { AiRepository, MilestoneSuggestion, MilestoneSuggestionsResponse } from '../../repositories/ai-repository';
import { MILESTONE_TEMPLATES } from '../../shared/constants/milestone-template';
import { UnifiedSuggestion } from '../../models/unified-suggestion';
import { MilestoneSuggestionsModel } from '../../models/milestone-suggestions-model';
import { ProjectDashboardStatsDTO } from '../../repositories/dto/project-dashboard-stats-dto';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { ProjectMapper } from '../../models/project-mapper';
import { IProjectJSON } from '../../repositories/dto/project-json';
import { QueueItem } from '../../models/queue-items/queue-item';
import { AddMemberPayload, DeleteProjectPayload, ProjectPayload, RemoveMemberPayload } from '../../models/queue-items/project-queue-item';
import { ProjectMember } from '../../models/project-member';
import { ProjectRole, UserModel } from '../../models/user-model';
import { UserSummary } from '../../models/user-summary';
import { TeamRepository } from '../../repositories/team-repository';
import { generateLocalId, isLocalId } from '../../shared/constants/id-const';
import { TrackMilestoneIgnorancePayload, TrackMilestonePayload } from '../../models/queue-items/track-milestone-selection-payload';
import { ConnectionService } from '../connection/connection-service';

export type ProjectAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ADD_MEMBER'
  | 'REMOVE_MEMBER'
  | 'TRACK_SELECTION'
  | 'TRACK_DEGRADATION'
  | 'TRACK_IGNORANCE';

@Injectable({
  providedIn: 'root'
})
export class ProjectDataManagerService extends BaseQueueDataManager {
  private projectRepository = inject(ProjectRepository);
  private teamRepository = inject(TeamRepository);
  private aiRepository = inject(AiRepository);
  private connectionService = inject(ConnectionService);

  private readonly GLOBAL_POOL_KEY = 'local_projects_global_pool';

  public allProjectsPool = signal<Project[]>([]);

  constructor() {
    super('ProjectDataManagerService');
    this.loadProjectsFromStorage();
  }

  // ==========================================
  // 🚀 BASE QUEUE DATA MANAGER HOOKS
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as ProjectAction;
    const payload = item.payload;

    switch (action) {
      case 'CREATE': {
        const createPayload = payload as ProjectPayload;
        // 🛡️ Security: Backend erzeugt eigene ID -> Local-ID entfernen
        const projectToSend = new Project({
          ...createPayload.project,
          id: undefined
        });
        return this.projectRepository.createProject(ProjectMapper.toJson(projectToSend));
      }
      case 'UPDATE': {
        const updatePayload = payload as ProjectPayload;
        return this.projectRepository.updateProject(ProjectMapper.toJson(updatePayload.project));
      }
      case 'DELETE': {
        const deletePayload = payload as DeleteProjectPayload;
        return this.projectRepository.deleteProject(deletePayload.id);
      }
      case 'ADD_MEMBER': {
        const addPayload = payload as AddMemberPayload;
        return this.teamRepository.assignToProject$(addPayload.id, addPayload.userId, addPayload.role);
      }
      case 'REMOVE_MEMBER': {
        const removePayload = payload as RemoveMemberPayload;
        return this.teamRepository.deleteFromProject$(removePayload.id, removePayload.userId);
      }
      case 'TRACK_SELECTION': {
        const selectionPayload = payload as TrackMilestonePayload;
        return this.aiRepository.trackMilestoneSelection(
          selectionPayload.projectTitle,
          selectionPayload.projectArea,
          selectionPayload.milestoneTitle,
          selectionPayload.userId
        );
      }
      case 'TRACK_DEGRADATION': {
        const degrPayload = payload as TrackMilestonePayload;
        return this.aiRepository.trackMilestoneDegradation(
          degrPayload.projectTitle,
          degrPayload.projectArea,
          degrPayload.milestoneTitle,
          degrPayload.userId
        );
      }
      case 'TRACK_IGNORANCE': {
        const ignorPayload = payload as TrackMilestoneIgnorancePayload;
        return this.aiRepository.trackMilestonesIgnore(
          ignorPayload.projectTitle,
          ignorPayload.projectArea,
          ignorPayload.userId,
          ignorPayload.milestoneTitles
        );
      }
      default:
        return throwError((): Error => new Error(`[ProjectDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override resetState(snapshot: IProjectJSON[]): void {
    if (Array.isArray(snapshot)) {
      const restored = snapshot.map((json: IProjectJSON) => ProjectMapper.toDomain(json));
      this.allProjectsPool.set(restored);
      this.saveListInLocalStorage(restored);
    }
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    const serverProjectJson = response as IProjectJSON;
    const realProject = ProjectMapper.toDomain(serverProjectJson);

    // 1. Wir holen uns das alte Projekt aus unserem Pool, solange es noch die lokalen Meilenstein-IDs hat!
    const oldProject = this.allProjectsPool().find(p => p.id === tempId);

    if (oldProject && oldProject.milestones && realProject.milestones) {
      // 2. Wir gehen alle Meilensteine durch und mappen die lokale ID auf die Server-ID
      oldProject.milestones.forEach((oldMilestone, index) => {
        const realMilestone = realProject.milestones[index];
        if (oldMilestone.id && realMilestone && realMilestone.id) {
          // Hier triggern wir den globalen ID-Austausch in der Queue für jeden einzelnen Meilenstein!
          this.queueService.updateEntityIdInQueue(oldMilestone.id, realMilestone.id);
        }
      });
    }

    // 3. Ganz normal das Projekt im Pool aktualisieren
    const updatedList = this.allProjectsPool().map((p) => (p.id === tempId ? realProject : p));
    this.allProjectsPool.set(updatedList);
    this.saveListInLocalStorage(updatedList);
  }

  // ==========================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.projectRepository.getAllProjects().pipe(
      map((backendProjectsJson: IProjectJSON[]): void => {
        const liveProjects = backendProjectsJson.map((json) => ProjectMapper.toDomain(json));
        this.saveListInLocalStorage(liveProjects);
        this.allProjectsPool.set(liveProjects);
      })
    );
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    const payload = item.payload;
    if (!payload) return;

    // Prüfen, ob das Payload ein Projekt enthält (CREATE oder UPDATE)
    if ('project' in payload && payload.project) {
      const projPayload = payload as ProjectPayload;

      // 1. Äußere Relationen prüfen
      if (projPayload.project.ideaId === localId) {
        projPayload.project.ideaId = serverId;
      }
      if (projPayload.project.departmentId === localId) {
        projPayload.project.departmentId = serverId;
      }

      // Auch im verschachtelten Milestones-Array nachfühlen!
      if (projPayload.project.milestones && Array.isArray(projPayload.project.milestones)) {
        projPayload.project.milestones.forEach((milestone) => {
          if (milestone.id === localId) {
            milestone.id = serverId;
          }
        });
      }
    }
  }

  // ==========================================
  // 📝 PUBLIC API METHODEN (mit Snapshots)
  // ==========================================

  public createProject(project: Project): void {
    const snapshot = this.getSnapshotJson();
    const updatedList = [...this.allProjectsPool(), project];

    this.allProjectsPool.set(updatedList);
    this.saveListInLocalStorage(updatedList);

    const payload: ProjectPayload = {
      id: project.id,
      project,
      snapshot
    };
    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public updateProject(project: Project): void {
    const snapshot = this.getSnapshotJson();
    const updatedList = this.allProjectsPool().map((p) => (p.id === project.id ? project : p));

    this.allProjectsPool.set(updatedList);
    this.saveListInLocalStorage(updatedList);

    const payload: ProjectPayload = {
      id: project.id,
      project,
      snapshot
    };
    this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
  }

  public deleteProject(id: string): void {
    const snapshot = this.getSnapshotJson();
    const newGlobalList = this.allProjectsPool().filter((p) => p.id !== id);

    this.allProjectsPool.set(newGlobalList);
    this.saveListInLocalStorage(newGlobalList);

    const deletePayload: DeleteProjectPayload = {
      id,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE', deletePayload);
  }

  public addMemberToProject(projectId: string, user: UserModel | UserSummary, projectRole: ProjectRole): void {
    if (isLocalId(projectId)) {
      return;
    }

    const snapshot = this.getSnapshotJson();
    const project = this.allProjectsPool().find((p) => p.id === projectId);
    if (!project) {
      return;
    }

    const newMemberBinding = new ProjectMember(user, projectRole);
    const filteredMembers = project.teamMembers.filter((memb) => memb.user.id !== user.id);
    const updatedProjectTeam = [...filteredMembers, newMemberBinding];
    const updatedProject = new Project({
      ...project,
      teamMembers: updatedProjectTeam
    });

    this.allProjectsPool.update((value) => value.map((proj) => (proj.id !== projectId ? proj : updatedProject)));
    this.saveListInLocalStorage(this.allProjectsPool());

    const payload: AddMemberPayload = {
      id: projectId,
      userId: user.id,
      role: projectRole,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'ADD_MEMBER', payload);
  }

  public removeMemberFromProject(projectId: string, userId: string): void {
    if (isLocalId(projectId)) {
      return;
    }

    const snapshot = this.getSnapshotJson();
    const targetProject = this.allProjectsPool().find((p) => p.id === projectId);
    if (!targetProject) {
      return;
    }

    const targetTeam = targetProject.teamMembers.filter((member) => member.user.id !== userId);
    const updatedProject = new Project({
      ...targetProject,
      teamMembers: targetTeam
    });

    this.allProjectsPool.update((value) => value.map((project) => (project.id !== projectId ? project : updatedProject)));
    this.saveListInLocalStorage(this.allProjectsPool());

    const payload: RemoveMemberPayload = {
      id: projectId,
      userId,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'REMOVE_MEMBER', payload);
  }

  // ==========================================================================
  // 💡 KI & MEILENSTEIN-SUGGESTIONS
  // ==========================================================================

  public getMilestoneSuggestions(title: string, area: string, userId: string): Observable<MilestoneSuggestionsModel> {
    if (this.connectionService.isOffline()) {
      return this.getMilestonesOffline();
    }

    return this.aiRepository.getMilestoneSuggestions(title, area, userId).pipe(
      map((suggestionsFromServer: MilestoneSuggestionsResponse): MilestoneSuggestionsModel => {
        const recommended = (suggestionsFromServer.recommended || []).map((s) => this.getMappedSuggestion(s, true));
        const degraded = (suggestionsFromServer.degraded || []).map((s) => this.getMappedSuggestion(s, false));
        return { recommended, degraded };
      }),
      catchError(() => this.getMilestonesOffline())
    );
  }

  private getMilestonesOffline(): Observable<MilestoneSuggestionsModel> {
    const offlineSuggestions: UnifiedSuggestion[] = [];
    const templatesRecord = MILESTONE_TEMPLATES as Record<string, Array<{ title: string; duration: number }>>;

    Object.keys(templatesRecord).forEach((category) => {
      templatesRecord[category].forEach((template) => {
        offlineSuggestions.push({
          title: template.title,
          duration: template.duration,
          source: 'TEMPLATE',
          isRecommended: true,
          words: []
        });
      });
    });

    return of({
      recommended: offlineSuggestions,
      degraded: []
    });
  }

  private getMappedSuggestion(suggestionDto: MilestoneSuggestion, isRecommended: boolean): UnifiedSuggestion {
    return {
      title: suggestionDto.title,
      score: suggestionDto.score,
      source: 'KI',
      isRecommended,
      words: suggestionDto.words || []
    };
  }

  // ==========================================================================
  // 📊 TRACKING & ANALYTICS
  // ==========================================================================

  public trackMilestoneSelection(projectTitle: string, projectArea: string, milestoneTitle: string, userId: string): void {
    const payload: TrackMilestonePayload = {
      id: generateLocalId(),
      projectTitle,
      projectArea,
      milestoneTitle,
      userId
    };

    this.queueService.enqueue(this.serviceName, 'TRACK_SELECTION', payload);
  }

  public trackMilestoneDegradation(projectTitle: string, projectArea: string, milestoneTitle: string, userId: string): void {
    const payload: TrackMilestonePayload = {
      id: generateLocalId(),
      projectTitle,
      projectArea,
      milestoneTitle,
      userId
    };

    this.queueService.enqueue(this.serviceName, 'TRACK_DEGRADATION', payload);
  }

  public trackMilestoneIgnorance(projectTitle: string, projectArea: string, userId: string, milestoneTitles: string[]): void {
    const payload: TrackMilestoneIgnorancePayload = {
      id: generateLocalId(),
      projectTitle,
      projectArea,
      milestoneTitles,
      userId
    };

    this.queueService.enqueue(this.serviceName, 'TRACK_IGNORANCE', payload);
  }

  public getDashboardStatistics(userId: string): Observable<ProjectDashboardStatsDTO> {
    if (this.connectionService.isOffline()) {
      return throwError((): Error => new Error('OFFLINE_MODE'));
    }
    return this.projectRepository.getDashboardStatistics(userId);
  }

  // ==========================================================================
  // 🛠️ PRIVATE HELPER & CACHE
  // ==========================================================================

  private saveListInLocalStorage(updatedList: Project[]): void {
    const cachePayload = updatedList.map((p) => ProjectMapper.toJson(p));
    this.localStorageService.setItem(this.GLOBAL_POOL_KEY, cachePayload);
  }

  private loadProjectsFromStorage(): void {
    const jsonList = this.localStorageService.getItem<IProjectJSON[]>(this.GLOBAL_POOL_KEY);
    const projects = jsonList ? jsonList.map((json) => ProjectMapper.toDomain(json)) : [];
    this.allProjectsPool.set(projects);
  }

  private getSnapshotJson(): IProjectJSON[] {
    return this.allProjectsPool().map((pr) => ProjectMapper.toJson(pr));
  }

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.localStorageService.removeItem(this.GLOBAL_POOL_KEY);
    this.allProjectsPool.set([]);
  }
}