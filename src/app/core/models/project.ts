import { computed } from "@angular/core";
import { Milestone } from "./milestone";
import { UserModel } from "./user-model";
import { IProjectJSON } from "../repositories/dto/project-json";

export interface IProjectInit {
  id?: string;
  ideaId: string;
  title: string;
  area: string;
  content?: string;
  status?: 'Calculation' | 'Active' | 'Zip';
  milestones?: Milestone[]; // 👁️ Hier im Init bleibt es optional für bequemes Erstellen!
  teamMembers?: UserModel[];     // 👁️ Hier auch.
}

export class Project implements IProjectJSON {
  public id: string;
  public ideaId: string;
  public title: string;
  public area: string;
  public content?: string;
  public status: 'Calculation' | 'Active' | 'Zip';
  public milestones: Milestone[];
  public teamMembers: UserModel[];

  constructor(init: IProjectInit) {
    this.id = init.id ? init.id : String(Date.now() + Math.floor(Math.random() * 1000));
    this.ideaId = init.ideaId;
    this.title = init.title;
    this.area = init.area;
    this.status = init.status ?? 'Calculation';
    this.content = init.content ?? ""
    // 🔥 Hier greift dein genialer Standardwert: Wenn im Init nichts übergeben wurde,
    // machen wir ein absolut sicheres, leeres Array daraus. Niemals null!
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