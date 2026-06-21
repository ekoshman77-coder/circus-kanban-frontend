import { computed } from "@angular/core";
import { Milestone } from "./milestone";
import { UserModel } from "./user-model";
import { IProjectJSON } from "../repositories/dto/project-json";
import { generateLocalId } from "../shared/constants/id-const";

export class Project {
  public id: string;
  public ideaId: string;
  public title: string;
  public area: string;
  public content: string;
  public status: 'Calculation' | 'Active' | 'Zip';
  public milestones: Milestone[];
  public teamMembers: UserModel[];

  // 💡 INLINE-KONSTRUKTOR: Keine extra Interfaces mehr nötig!
  constructor(init: {
    ideaId: string;
    title: string;
    area: string;
    id?: string;
    content?: string;
    status?: 'Calculation' | 'Active' | 'Zip';
    milestones?: Milestone[];
    teamMembers?: UserModel[];
  }) {
    this.title = init.title;
    this.area = init.area;
    this.ideaId = init.ideaId;
    
    // 🛡️ Sichere Defaults für alles Optionale
    this.id = init.id ?? generateLocalId();
    this.status = init.status ?? 'Calculation';
    this.content = init.content ?? "";
    this.milestones = init.milestones ?? [];
    this.teamMembers = init.teamMembers ?? [];
  }

  // 🧮 Geplante Zeit (Soll)
  public getTotalDuration(): number {
    return this.milestones.reduce((sum: number, m: Milestone) => sum + Number(m.duration), 0);
  }

  // 📐 Berechnet reaktiv die Gesamtdauer aller Meilensteine.
  // WICHTIG: Number() fängt HTML-String-Konvertierungen ab, damit nicht "1" + "2" = "12" passiert!
  public getTotalUsedDuration(): number {
    return this.milestones.reduce((sum, m) => sum + m.usedDuration, 0);
  }

  // 📊 Fortschritt in Prozent
  public getProgressPercentage(): number {
    if (this.milestones.length === 0) return 0;
    const completed = this.milestones.filter(m => m.isCompleted()).length;
    return Math.round((completed / this.milestones.length) * 100);
  }

  public isInCalculation = computed(() => this.status === 'Calculation' )

  public isActive = computed(() => this.status === "Active")
}