import { Milestone } from '../../models/milestone';
import { Project } from '../../models/project';
import { ProjectMapper } from '../../models/project-mapper';
import { ProjectMember } from '../../models/project-member';
import { ProjectAction } from '../../models/queue-items/project-queue-item';
import { IProjectJSON } from '../../repositories/dto/project-json';
import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';

export interface IdReplacement {
  localId: string;
  serverId: string;
}

export class ProjectStateProvider extends ArrayStateProvider<Project> {
  protected storageKey = 'local_projects_global_pool';

  constructor() {
    super([]);
  }

  // 1. CACHE LADEN
  public override loadFromCache(): void {
    const cachedData = this.localStorageService.getItem<IProjectJSON[]>(this.storageKey);
    if (cachedData && Array.isArray(cachedData)) {
      const restored = cachedData.map((json: IProjectJSON) => ProjectMapper.toDomain(json));
      this.setRawState(restored);
    }
  }

  // 2. FORWARD REPLAY & AKTIONEN
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as ProjectAction) {
      case 'SET_PROJECTS': {
        const projects = Array.isArray(payload?.projects) ? payload.projects : [];
        this.setRawState(projects);
        break;
      }
      case 'CREATE': {
        if (payload?.project) {
          this.applyAction((projects) => [...projects, payload.project]);
        }
        break;
      }
      case 'UPDATE': {
        if (payload?.project) {
          this.applyAction((projects) =>
            projects.map((p) => (p.id === payload.project.id ? payload.project : p))
          );
        }
        break;
      }
      case 'DELETE': {
        if (payload?.id) {
          this.removeItemById(payload.id);
        }
        break;
      }
      case 'ADD_MEMBER': {
        if (payload?.projectId && payload?.user && payload?.role) {
          this.applyAction((projects) =>
            projects.map((proj) => {
              if (proj.id !== payload.projectId) return proj;
              const newMemberBinding = new ProjectMember(payload.user, payload.role);
              const filteredMembers = proj.teamMembers.filter((memb) => memb.user.id !== payload.user.id);
              return new Project({
                ...proj,
                teamMembers: [...filteredMembers, newMemberBinding]
              });
            })
          );
        }
        break;
      }
      case 'REMOVE_MEMBER': {
        if (payload?.projectId && payload?.userId) {
          this.applyAction((projects) =>
            projects.map((proj) => {
              if (proj.id !== payload.projectId) return proj;
              const targetTeam = proj.teamMembers.filter((member) => member.user.id !== payload.userId);
              return new Project({
                ...proj,
                teamMembers: targetTeam
              });
            })
          );
        }
        break;
      }
    }
  }

  public replaceIdsBulk(projectIdReplacement: IdReplacement, milestoneReplacements: IdReplacement[]): void {
    if (!projectIdReplacement && (!milestoneReplacements || milestoneReplacements.length === 0)) {
      return;
    }

    // Map für schnellen O(1)-Zugriff auf die Meilenstein-IDs
    const msMap = new Map<string, string>();
    milestoneReplacements.forEach((r) => msMap.set(r.localId, r.serverId));

    this.applyAction((projects) =>
      projects.map((proj) => {
        // Prüfe, ob dieses Projekt das Zielprojekt ist (entweder alte Temp-ID oder bereits Server-ID)
        const isTargetProject = proj.id === projectIdReplacement.localId || proj.id === projectIdReplacement.serverId;

        if (!isTargetProject) {
          return proj;
        }

        // 1. Projekt-ID anpassen
        const updatedProjectId = proj.id === projectIdReplacement.localId 
          ? projectIdReplacement.serverId 
          : proj.id;

        // 2. Meilenstein-IDs im Zielprojekt in einem Rutsch anpassen
        const updatedMilestones = proj.milestones.map((m) => {
          if (m.id && msMap.has(m.id)) {
            return new Milestone({ ...m, id: msMap.get(m.id)! });
          }
          return m;
        });

        return new Project({
          ...proj,
          id: updatedProjectId,
          milestones: updatedMilestones
        });
      })
    );
  }

  // 3. RESTORE FROM SNAPSHOT
  public override restoreFromSnapshot(snapshot: unknown): void {
    if (Array.isArray(snapshot)) {
      const restored = (snapshot as IProjectJSON[]).map((json) => ProjectMapper.toDomain(json));
      this.setRawState(restored);
    }
  }
}