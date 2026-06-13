// core/models/team-member.ts

export interface ITeamMemberInit {
  id: string;
  firstName: string;
  lastName: string;
  colorOverride?: string;
}

export class TeamMember {
  public id: string;
  public firstName: string;
  public lastName: string;
  public colorOverride?: string;

  constructor(init: ITeamMemberInit) {
    this.id = init.id;
    this.firstName = init.firstName;
    this.lastName = init.lastName;
    this.colorOverride = init.colorOverride
  }

  // 🔤 Dynamischer voller Name
  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // 🔤 Dynamische Initialen (Immer bombenfest aus Vor- und Nachname)
  public get initials(): string {
    const firstLetter = this.firstName ? this.firstName[0] : '';
    const lastLetter = this.lastName ? this.lastName[0] : '';
    return (firstLetter + lastLetter).toUpperCase();
  }

  // 🎨 Der HSL-Farbkreis-Hash (Das 360-Grad-Pastell-Wunder!)
  public get color(): string {
    if (this.colorOverride) {
        return this.colorOverride
    }

    let hash = 0;
    for (let i = 0; i < this.id.length; i++) {
      hash = this.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 75%, 85%)`; // Festgezurrt auf 85% Helligkeit für Pastell
  }
}