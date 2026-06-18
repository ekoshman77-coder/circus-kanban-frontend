import { IMilestoneJSON, TodoTeamStatus } from "../repositories/dto/milestone-json";
import { Todo } from "./todo";
import { UserModel } from "./user-model";

export interface IMilestoneInit {
  id?: string; // 🆕 Optional für ganz neue Meilensteine
  title: string;
  duration: number;
  usedDuration?: number; // 🆕 Optional beim Erstellen (wird zu 0)
  status?: TodoTeamStatus; // 🆕 Optional (wird zu 'Offen')
  assignedUserId?: string | null;
  assignedUser?: UserModel | null; // Falls du das voll aufgelöste User-Objekt hast
  projectId?: string | null;  // 📁 NEU: Die Verbindung zum Projekt für unser Backend!
}

export class Milestone implements IMilestoneJSON {
  public id: string;
  public title: string;
  public duration: number;
  public usedDuration: number;
  public status: TodoTeamStatus;
  public assignedUserId?: string | null;
  public assignedUser?: UserModel | null;
  public projectId?: string | null; 

  private localIdPrefix: string = 'local-';

  constructor(init: IMilestoneInit) {
    // 🔥 Automatische Offline-ID Generierung, falls keine ID übergeben wird
    this.id = init.id ? init.id : this.localIdPrefix + String(Date.now() + Math.floor(Math.random() * 1000));
    this.title = init.title;
    this.duration = init.duration;
    this.usedDuration = init.usedDuration ?? 0;
    this.status = init.status ?? 'Offen';
    this.assignedUser = init.assignedUser?? null
    this.assignedUserId = init.assignedUserId;
    this.projectId = init.projectId;
  }

  static fromMilestone(oldMs: Milestone): Milestone {
    return new Milestone({
      id: oldMs.id,
      title: oldMs.title,
      duration: oldMs.duration,
      usedDuration: oldMs.usedDuration,
      status: oldMs.status,
      assignedUserId: oldMs.assignedUserId,
      assignedUser: oldMs.assignedUser,
      projectId: oldMs.projectId,
     });
  }

  public isCompleted(): boolean {
    return this.status === 'Erledigt';
  }

  public toJSON(): IMilestoneJSON {
    const isLocal = this.id.startsWith(this.localIdPrefix)
    return {
      id: isLocal? "" : this.id,
      title: this.title,
      duration: this.duration,
      usedDuration: this.usedDuration,
      status: this.status,
      assignedUserId: this.assignedUserId,
      projectId: this.projectId
    };
  }
}
