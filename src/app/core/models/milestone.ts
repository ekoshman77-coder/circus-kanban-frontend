import { IMilestoneJSON, TodoTeamStatus } from "../repositories/dto/milestone-json";
import { generateLocalId, isLocalId } from "../shared/constants/id-const";
import { DomainModel } from "./domain-model";
import { UserModel } from "./user-model";

export class Milestone implements DomainModel< Milestone > {
  public id: string;
  public title: string;
  public duration: number;
  public usedDuration: number;
  public status: TodoTeamStatus;
  public assignedUserId?: string | null;
  public assignedUser?: UserModel | null;
  public projectId?: string | null;
  public orderIndex: number; // 🔢 Die Sortierung ist jetzt fest eingebaut!

  // 💡 DEIN NEUER PRAGMATISCHER PRÄZISIONS-KONSTRUKTOR:
  // Nur 'title' und 'duration' sind Pflicht. Alles andere ist optional (?) und sichert sich über '??' ab!
  constructor(init: {
    title: string;
    duration: number;
    id?: string;
    usedDuration?: number;
    status?: TodoTeamStatus;
    assignedUserId?: string | null;
    assignedUser?: UserModel | null;
    projectId?: string | null;
    orderIndex?: number;
  }) {
    this.title = init.title;
    this.duration = init.duration;

    // 🛡️ Automatische Fallbacks für alles Optionale:
    this.id = init.id ?? generateLocalId();
    this.usedDuration = init.usedDuration ?? 0;
    this.status = init.status ?? 'Offen';
    this.assignedUser = init.assignedUser ?? null;
    this.assignedUserId = init.assignedUserId ?? null;
    this.projectId = init.projectId ?? null;
    this.orderIndex = init.orderIndex ?? 0; // Standardmäßig ganz vorne (0)
  }

  // 🔄 Ein bequemer Klon-Helfer, falls wir ein Objekt duplizieren müssen
  static fromMilestone(oldMs: Milestone): Milestone {
    return new Milestone({ ...oldMs });
  }

  public isCompleted(): boolean {
    return this.status === 'Erledigt';
  }

  public cloneWith(changes: Partial< Milestone >): Milestone {
    return new Milestone({
      id: changes.id ?? this.id,
      title: changes.title ?? this.title,
      duration: changes.duration ?? this.duration,
      usedDuration: changes.usedDuration ?? this.usedDuration,
      status: changes.status ?? this.status,
      assignedUserId: changes.assignedUserId !== undefined ? changes.assignedUserId : this.assignedUserId,
      assignedUser: changes.assignedUser !== undefined ? changes.assignedUser : this.assignedUser,
      projectId: changes.projectId !== undefined ? changes.projectId : this.projectId,
      orderIndex: changes.orderIndex ?? this.orderIndex
    });
  }

  // 📡 Für dein Kotlin-Backend: Bereitet die Daten für das JSON-Format vor
  public toJson(): any {
    const isLocal = isLocalId(this.id);
    return {
      id: isLocal ? "" : this.id,
      title: this.title,
      duration: this.duration,
      usedDuration: this.usedDuration,
      status: this.status,
      assignedUserId: this.assignedUserId,
      projectId: this.projectId,
      orderIndex: this.orderIndex // Schicken wir direkt mit zum Server!
    };
  }

  public static fromJson(json: IMilestoneJSON): Milestone {
    return new Milestone({
      id: json.id,
      title: json.title,
      duration: json.duration,
      usedDuration: json.usedDuration,
      status: json.status,
      assignedUserId: json.assignedUserId,
      assignedUser: json.assignedUser,
      projectId: json.projectId,
      orderIndex: json.orderIndex
    });
  }
}