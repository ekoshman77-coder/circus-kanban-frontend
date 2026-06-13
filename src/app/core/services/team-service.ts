// core/services/team-service.ts
import { Injectable, signal, computed } from '@angular/core';
import { TeamMember } from '../models/teammember';

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  // 🔒 Der private, reaktive Zustand (Die Quelle der Wahrheit)
  private membersSignal = signal<TeamMember[]>([]);

  // 🔓 Die öffentliche Lese-Schnittstelle für deine Komponenten
  public membersList = computed(() => this.membersSignal());

  constructor() {
    this.loadInitialTeam();
  }

  /**
   * 👥 Start-Zustand: Wir legen direkt 3 coole Pastell-Testuser an,
   * damit dein Board beim ersten Start nicht komplett leer ist!
   */
  private loadInitialTeam(): void {
    const defaultMembers = [
      new TeamMember({ id: 'tm_1_Anna', firstName: 'Anna', lastName: 'Schmidt' }),
      new TeamMember({ id: 'tm_2_Max', firstName: 'Max', lastName: 'Mustermann' }),
      new TeamMember({ id: 'tm_3_Julia', firstName: 'Julia', lastName: 'Coder' })
    ];
    this.membersSignal.set(defaultMembers);
  }

  /**
   * ➕ Ein neues Teammitglied über ein Formular registrieren
   */
  public createTeamMember(firstName: string, lastName: string): void {
    if (!firstName.trim() || !lastName.trim()) return;

    const newMember = new TeamMember({
      id: 'tm_' + Math.random().toString(36).substring(2, 9) + firstName, // Zufalls-ID simuliert Server
      firstName: firstName.trim(),
      lastName: lastName.trim()
    });

    // Reaktives Update: Alten Stand nehmen, neuen User hinten dran hängen
    this.membersSignal.set([...this.membersSignal(), newMember]);
    console.log('👥 Neues Teammitglied im RAM gespeichert:', newMember.fullName);
  }

public randomizeMemberColor(memberId: string): void {
    const randomHue = Math.floor(Math.random() * 360);
    const newPastelColor = `hsl(${randomHue}, 75%, 85%)`;

    // 🔥 Wir mappen das Array und ersetzen das alte Mitglied durch ein echtes, neues Datenmodell MIT Farbe!
    this.membersSignal.set(
      this.membersSignal().map(member => {
        if (member.id === memberId) {
          return new TeamMember({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            colorOverride: newPastelColor // 💾 Fest im neuen Zustand eingebrannt!
          });
        }
        return member;
      })
    );
  }
}