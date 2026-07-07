import { ProjectRole, UserModel } from "./user-model";

export class ProjectMember {
  public user: UserModel;
  public projectRole: ProjectRole;

  constructor(user: UserModel, projectRole: ProjectRole = 'NONE') { // 🌟 Standardwert 'NONE' im Konstruktor!
    this.user = user;
    this.projectRole = projectRole;
  }

  /**
   * 🛡️ Hilfsmethode direkt an der Klasse (Optional, aber super praktisch!)
   */
  public isGlobalOnly(): boolean {
    return this.projectRole === 'NONE';
  }
}