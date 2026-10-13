import { Milestone } from '../../models/milestone';
import { Project } from '../../models/project';
import { ProjectMember } from '../../models/project-member';
import { ProjectAction } from '../../models/queue-items/project-queue-item';
import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';

export interface IdReplacement {
  localId: string;
  serverId: string;
}

export class ProjectStateProvider extends ArrayStateProvider< Project > {
  protected override storageKey = 'local_projects_global_pool';
  
  // 🎯 Statische Modell-Referenz für generisches Deserialisieren & Cache-Laden
  protected modelStatic = Project;

  constructor() {
    super([]);
  }

  // 🚀 FORWARD REPLAY & AKTIONEN
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as ProjectAction) {
      case 'SET_PROJECTS': {
        const projects = Array.isArray(payload?.projects) 
          ? payload.projects.map((p: any) => p instanceof Project ? p : Project.fromJson(p))
          : [];
        this.setRawState(projects);
        break;
      }
      case 'CREATE': {
        if (payload?.project) {
          const projInstance = payload.project instanceof Project ? payload.project : Project.fromJson(payload.project);
          this.addOrUpdateItem(projInstance);
        }
        break;
      }
      case 'UPDATE': {
        if (payload?.project) {
          const projInstance = payload.project instanceof Project ? payload.project : Project.fromJson(payload.project);
          this.addOrUpdateItem(projInstance);
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
              
              return proj.cloneWith({
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
              
              return proj.cloneWith({
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

    const msMap = new Map();
    milestoneReplacements.forEach((r) => msMap.set(r.localId, r.serverId));

    this.applyAction((projects) =>
      projects.map((proj) => {
        const isTargetProject = proj.id === projectIdReplacement.localId || proj.id === projectIdReplacement.serverId;

        if (!isTargetProject) {
          return proj;
        }

        const updatedProjectId = proj.id === projectIdReplacement.localId 
          ? projectIdReplacement.serverId 
          : proj.id;

        const updatedMilestones = proj.milestones.map((m) => {
          if (m.id && msMap.has(m.id)) {
            return m.cloneWith({ id: msMap.get(m.id)! });
          }
          return m;
        });

        return proj.cloneWith({
          id: updatedProjectId,
          milestones: updatedMilestones
        });
      })
    );
  }
}