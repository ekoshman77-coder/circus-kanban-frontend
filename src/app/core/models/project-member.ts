import { ProjectRole, UserModel } from "./user-model";
import { UserSummary } from "./user-summary";

export class ProjectMember {
  public user: UserModel;
  public projectRole: ProjectRole;
  public isPending: boolean

  constructor(user: UserModel | UserSummary, projectRole: ProjectRole = 'NONE') { 
    if (user instanceof UserSummary) {
      this.user = user.createPendingUser()
      this.isPending = true
    } else {
      this.user = user;
      this.isPending = false
    }
    
    this.projectRole = projectRole;
  }

  /**
   * 🛡️ Hilfsmethode direkt an der Klasse (Optional, aber super praktisch!)
   */
  public isGlobalOnly(): boolean {
    return this.projectRole === 'NONE';
  }
}