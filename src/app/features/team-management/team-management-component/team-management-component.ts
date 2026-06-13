import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../../core/services/team-service';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-management-component.html',
  styleUrl: './team-management-component.css'
})
export class TeamManagementComponent {
  // 🔌 Service-Injection
  public teamService = inject(TeamService);

  // 📝 Lokale Formular-Zustände (Zwei-Wege-Binding über ngModel)
  public firstNameInput = '';
  public lastNameInput = '';

  // 💾 Das reaktive Signal für das Template bereitstellen
  public members = this.teamService.membersList;

  /**
   * ➕ Schickt die Daten an den Service, um einen Kollegen anzulegen
   */
  public onAddMember(event: Event): void {
    event.preventDefault(); // Verhindert das Neuladen der Seite beim Abschicken

    const fName = this.firstNameInput.trim();
    const lName = this.lastNameInput.trim();

    if (!fName || !lName) return;

    // Ab in den Service!
    this.teamService.createTeamMember(fName, lName);

    // Formularfelder danach wieder elegant leeren
    this.firstNameInput = '';
    this.lastNameInput = '';
  }

  public randomizeMemberColor(memberId: string) {
    this.teamService.randomizeMemberColor(memberId)
  }
}