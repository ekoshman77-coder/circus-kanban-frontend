import { inject, Injectable, Signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ProjectRepository } from '../../repositories/project-repository';
import { Project } from '../../models/project';
import { AiRepository, MilestoneSuggestion, MilestoneSuggestionsResponse } from '../../repositories/ai-repository';
import { MILESTONE_TEMPLATES } from '../../shared/constants/milestone-template';
import { UnifiedSuggestion } from '../../models/unified-suggestion';
import { MilestoneSuggestionsModel } from '../../models/milestone-suggestions-model';
import { ProjectDashboardStatsDTO } from '../../repositories/dto/project-dashboard-stats-dto';
import { ProjectMapper } from '../../models/project-mapper';
import { IProjectJSON } from '../../repositories/dto/project-json';
import { QueueItem } from '../../models/queue-items/queue-item';
import {
  AddMemberPayload,
  DeleteProjectPayload,
  ProjectAction,
  ProjectPayload,
  RemoveMemberPayload,
  TrackMilestoneIgnorancePayload,
  TrackMilestonePayload
} from '../../models/queue-items/project-queue-item';
import { ProjectRole, UserModel } from '../../models/user-model';
import { UserSummary } from '../../models/user-summary';
import { TeamRepository } from '../../repositories/team-repository';
import { generateLocalId, isLocalId } from '../../shared/constants/id-const';
import { ConnectionService } from '../connection/connection-service';
import { IdReplacement, ProjectStateProvider } from './project-state-provider';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';

@Injectable({
  providedIn: 'root'
})
export class ProjectDataManagerService extends BaseQueueDataManager {
  private projectRepository = inject(ProjectRepository);
  private teamRepository = inject(TeamRepository);
  private aiRepository = inject(AiRepository);
  private connectionService = inject(ConnectionService);

  constructor() {
    super('ProjectDataManagerService');
    (this.stateProvider as ProjectStateProvider).loadFromCache();
  }

  protected override createStateProvider(): ProjectStateProvider {
    return new ProjectStateProvider();
  }

  public get allProjectsPool(): Signal<Project[]> {
    return this.getSignal() as Signal<Project[]>;
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

  protected override handleSuccessResult(item: QueueItem, response: any): void {
    // 1. Basisklasse tauscht die Haupt-Projekt-ID in der Queue & ruft standardmäßig replaceId auf
    super.handleSuccessResult(item, response);

    if (item.action === 'CREATE' && response) {
      const localProject = (item.payload as ProjectPayload)?.project;
      const serverProjectJson = response as IProjectJSON;
      const serverProject = ProjectMapper.toDomain(serverProjectJson);

      if (localProject?.milestones && serverProject?.milestones) {
        const milestoneReplacements: IdReplacement[] = [];

        // Zuordnung direkt aus Payload vs. Response (z. B. über Index oder Title)
        localProject.milestones.forEach((localMs, index) => {
          const serverMs = serverProject.milestones[index]; // oder match per title/orderIndex

          if (localMs?.id && serverMs?.id && localMs.id !== serverMs.id) {
            // A) Queue informieren
            this.queueService.updateEntityIdInQueue(localMs.id, serverMs.id);

            // B) Für Bulk-Ersetzung vormerken
            milestoneReplacements.push({
              localId: localMs.id,
              serverId: serverMs.id
            });
          }
        });

        // 2. Ersetzung im Provider mit den gesammelten Paaren anstoßen
        if (milestoneReplacements.length > 0) {
          (this.stateProvider as ProjectStateProvider).replaceIdsBulk(
            { localId: localProject.id, serverId: serverProject.id },
            milestoneReplacements
          );
        }
      }
    }
  }

  // ==========================================
  // 🔄 REHYDRATION PATTERN
  // ==========================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.projectRepository.getAllProjects().pipe(
      map((backendProjectsJson: IProjectJSON[]): void => {
        const liveProjects = backendProjectsJson.map((json) => ProjectMapper.toDomain(json));
        this.stateProvider.applyActionPayload('SET_PROJECTS', { projects: liveProjects });
      })
    );
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    super.checkAndReplaceIds(item, localId, serverId);

    const payload = item.payload;
    if (!payload) return;

    if ('project' in payload && payload.project) {
      const projPayload = payload as ProjectPayload;

      if (projPayload.project.ideaId === localId) {
        projPayload.project.ideaId = serverId;
      }
      if (projPayload.project.departmentId === localId) {
        projPayload.project.departmentId = serverId;
      }

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
  // 📝 PUBLIC API METHODEN
  // ==========================================

  public createProject(project: Project): void {
    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('CREATE', { project });

    const payload: ProjectPayload = {
      id: project.id,
      project,
      snapshot
    };
    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public updateProject(project: Project): void {
    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('UPDATE', { project });

    const payload: ProjectPayload = {
      id: project.id,
      project,
      snapshot
    };
    this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
  }

  public deleteProject(id: string): void {
    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('DELETE', { id });

    const deletePayload: DeleteProjectPayload = {
      id,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE', deletePayload);
  }

  public addMemberToProject(projectId: string, user: UserModel | UserSummary, projectRole: ProjectRole): void {
    if (isLocalId(projectId)) return;

    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('ADD_MEMBER', { projectId, user, role: projectRole });

    const payload: AddMemberPayload = {
      id: projectId,
      userId: user.id,
      role: projectRole,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'ADD_MEMBER', payload);
  }

  public removeMemberFromProject(projectId: string, userId: string): void {
    if (isLocalId(projectId)) return;

    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('REMOVE_MEMBER', { projectId, userId });

    const payload: RemoveMemberPayload = {
      id: projectId,
      userId,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'REMOVE_MEMBER', payload);
  }

  // ==========================================
  // 🔗 DEPENDENCY & CHAIN EXTRACTION
  // ==========================================

  public override extractEntityIds(item: QueueItem): string[] {
    const ids = super.extractEntityIds(item);
    const payload = item.payload;
    if (!payload) return ids;

    if ('project' in payload && payload.project) {
      const proj = payload.project as Project;
      
      // 1. Idee-Abhängigkeit
      if (proj.ideaId) {
        ids.push(proj.ideaId);
      }

      // 2. Department-Abhängigkeit
      if (proj.departmentId) {
        ids.push(proj.departmentId);
      }

      // 3. Meilenstein-IDs sammeln
      if (proj.milestones && Array.isArray(proj.milestones)) {
        proj.milestones.forEach((m) => {
          if (m.id) {
            ids.push(m.id);
          }
        });
      }
    }

    return ids;
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

  public override checkUnsavedData(): string | null {
    return null;
  }
}