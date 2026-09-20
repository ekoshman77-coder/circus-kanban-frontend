import { Identifiable } from "./identifable";
import { ProjectRole, UserModel } from "./user-model";
import { UserSummary } from "./user-summary";
import { IProjectMemberJSON } from "../repositories/dto/project-member-json";

export class ProjectMember implements Identifiable {
  public user: UserModel;
  public projectRole: ProjectRole;
  public isPending: boolean;

  constructor(user: UserModel | UserSummary, projectRole: ProjectRole = 'NONE') { 
    if (user instanceof UserSummary) {
      this.user = user.createPendingUser();
      this.isPending = true;
    } else {
      this.user = user;
      this.isPending = false;
    }
    this.projectRole = projectRole;
  }

  public get id(): string {
    return this.user.id;
  }

  public isGlobalOnly(): boolean {
    return this.projectRole === 'NONE';
  }

  public toJson(): IProjectMemberJSON {
    return {
      user: this.user.toJson(),
      projectRole: this.projectRole
    };
  }

  public static fromJson(json: IProjectMemberJSON): ProjectMember {
    return new ProjectMember(UserModel.fromJson(json.user), json.projectRole as ProjectRole);
  }

  public cloneWith(changes: 
    { 
      user?: UserModel; 
      projectRole?: ProjectRole 
    }): ProjectMember {
    return new ProjectMember(changes.user ?? this.user, changes.projectRole ?? this.projectRole);
  }
}