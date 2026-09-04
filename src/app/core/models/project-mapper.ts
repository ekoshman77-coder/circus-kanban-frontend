// src/app/mappers/project-mapper.ts
import { Project } from '../models/project';
import { IProjectJSON } from '../repositories/dto/project-json';
import { Milestone } from '../models/milestone';
import { ProjectMember } from '../models/project-member';
import { UserModel } from '../models/user-model';
import { ProjectRole } from '../models/user-model';

export class ProjectMapper {

  /**
   * DTO (Server) ➔ Domain (Frontend)
   */
  public static toDomain(json: IProjectJSON): Project {
    console.log("toDomain", json )
    return new Project({
      id: json.id,
      title: json.title,
      area: json.area,
      ideaId: json.ideaId,
      userId: json.userId,
      content: json.content || '',
      departmentId: json.departmentId,
      status: json.status,
      scope: json.scope,
      // 1. Meilensteine sauber mappen
      milestones: (json.milestones?? []).map(m => {
        const milestone = Milestone.fromJSON(m);
        console.log("🛠️ CONVERTED MILESTONE:", milestone);
        return milestone;
      }),      
      // 2. Team-Mitglieder INKLUSIVE Projektrollen mappen!
      teamMembers: (json.teamMembers || []).map(m => {
        const userModel = UserModel.fromJson(m.user);
        return new ProjectMember(userModel, (m.projectRole as ProjectRole) || 'DEVELOPER');
      })
    });
  }

  /**
   * Domain (Frontend) ➔ DTO (Server)
   */
  public static toJson(project: Project): IProjectJSON {
    return {
      id: project.id,
      title: project.title,
      area: project.area,
      ideaId: project.ideaId,
      userId: project.userId,
      content: project.content,
      departmentId: project.departmentId,
      status: project.status,
      scope: project.scope,
      // 1. Meilensteine zu JSON
      milestones: project.milestones.map(m => m.toJSON()),
      // 2. ProjectMember zurück zu IProjectMemberJSON
      teamMembers: project.teamMembers.map(m => ({
        user: m.user.toJson(),
        projectRole: m.projectRole
      }))
    };
  }
}