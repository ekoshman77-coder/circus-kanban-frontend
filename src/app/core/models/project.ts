import { computed } from "@angular/core";
import { Milestone } from "./milestone";
import { ProjectRole, UserModel } from "./user-model";
import { IProjectJSON } from "../repositories/dto/project-json";
import { generateLocalId } from "../shared/constants/id-const";
import { ProjectMember } from "./project-member";
import { DomainModel } from "./domain-model";

export class Project implements DomainModel< Project > {
  public id: string;
  public userId: string;
  public ideaId: string;
  public title: string;
  public area: string;
  public content: string;
  public departmentId: string;
  public status: 'Calculation' | 'Active' | 'Zip';
  public milestones: Milestone[];
  public scope: string;
  public teamMembers: ProjectMember[];

  constructor(init: {
    ideaId: string;
    title: string;
    userId: string;
    area: string;
    id?: string;
    content?: string;
    departmentId: string;
    status?: 'Calculation' | 'Active' | 'Zip';
    milestones?: Milestone[];
    teamMembers?: ProjectMember[];
    scope?: string;
  }) {
    this.title = init.title;
    this.area = init.area;
    this.ideaId = init.ideaId;
    this.userId = init.userId;
    
    this.id = init.id ?? generateLocalId();
    this.status = init.status ?? 'Calculation';
    this.content = init.content ?? "";
    this.departmentId = init.departmentId;
    this.milestones = init.milestones ?? [];
    this.teamMembers = init.teamMembers ?? [];
    this.scope = init.scope ?? "DEPARTMENT";
  }

  // 🛡️ Typensicher klonen ohne Prototyp-Verlust
  public cloneWith(changes: Partial< Project >): Project {
    return new Project({
      id: changes.id ?? this.id,
      title: changes.title ?? this.title,
      area: changes.area ?? this.area,
      ideaId: changes.ideaId ?? this.ideaId,
      userId: changes.userId ?? this.userId,
      content: changes.content !== undefined ? changes.content : this.content,
      departmentId: changes.departmentId ?? this.departmentId,
      status: changes.status ?? this.status,
      scope: changes.scope ?? this.scope,
      milestones: changes.milestones ?? this.milestones,
      teamMembers: changes.teamMembers ?? this.teamMembers
    });
  }

  // 📥 Server-DTO ➔ Domain Model
  public static fromJson(json: IProjectJSON): Project {
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
      milestones: (json.milestones ?? []).map(m => Milestone.fromJson(m)),
      teamMembers: (json.teamMembers ?? []).map(m => ProjectMember.fromJson(m))
    });
  }

  // 📤 Domain Model ➔ Server-DTO
  public toJson(): IProjectJSON {
    return {
      id: this.id,
      title: this.title,
      area: this.area,
      ideaId: this.ideaId,
      userId: this.userId,
      content: this.content,
      departmentId: this.departmentId,
      status: this.status,
      scope: this.scope,
      milestones: this.milestones.map(m => m.toJson()),
      teamMembers: this.teamMembers.map(m => m.toJson())
    };
  }

  // 🧮 Domain-Logik
  public getTotalDuration(): number {
    return this.milestones.reduce((sum: number, m: Milestone) => sum + Number(m.duration), 0);
  }

  public getTotalUsedDuration(): number {
    return this.milestones.reduce((sum, m) => sum + m.usedDuration, 0);
  }

  public getProgressPercentage(): number {
    if (this.milestones.length === 0) return 0;
    const completed = this.milestones.filter(m => m.isCompleted()).length;
    return Math.round((completed / this.milestones.length) * 100);
  }

  public isInCalculation = computed(() => this.status === 'Calculation');
  public isActive = computed(() => this.status === "Active");

  public getUserRole(userId: string): ProjectRole {
    const member = this.teamMembers.find(m => m.user.id === userId);
    return member ? member.projectRole : 'DEVELOPER';
  }
}