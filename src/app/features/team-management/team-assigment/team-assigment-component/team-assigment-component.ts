import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamService } from '../../../../core/services/team-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProjectMembersListComponent } from '../project-members-list/project-members-list';
import { AvailablePoolListComponent } from '../available-pool-list/available-pool-list';
import { ProjectService } from '../../../../core/services/project-service';
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';

@Component({
  selector: 'app-team-assignment',
  standalone: true,
  // 📦 Wir importieren unsere beiden neuen Mini-Kind-Komponenten direkt hier!
  imports: [CommonModule, ProjectMembersListComponent, AvailablePoolListComponent, MemberCardComponent],
  templateUrl: './team-assigment-component.html',
  styleUrl: './team-assigment-component.css'
})
export class TeamAssigmentComponent {
  private teamService = inject(TeamService);
  private projectService = inject(ProjectService)

  // 📂 Zustand: Welches Projekt hat der Admin im Dropdown ausgewählt?
  // Wir starten mit 'null' (kein Projekt ausgewählt)
  public selectedProjectId = signal<string | null>(null);

  // 📡 Datenquelle 1: Alle Projekte vom Server holen
  public allProjects = computed(() =>this.projectService.projectsList());

  // 📡 Datenquelle 2: Alle globalen User (null-Pipeline) für den Gesamtpool
  private allUsers = toSignal(this.teamService.getSortedMembers$(null), { initialValue: [] });

  // 👥 KIND 1 DATEN (computed): Wer ist SCHON IM PROJEKT?
  public activeMembers = computed(() => {
    const projId = this.selectedProjectId();
    if (!projId) return [];
    
    // Filter: Alle User, die dieses Projekt in ihrer projectIds-Liste haben
    return this.allUsers().filter(user => user.projectIds.includes(projId));
  });

  // 👥 KIND 2 DATEN (computed): Wer sitzt noch auf der WARTEBANK (Verfügbarer Pool)?
  public availablePool = computed(() => {
    const projId = this.selectedProjectId();
    if (!projId) return this.allUsers(); // Wenn kein Projekt gewählt, zeig alle

    // Filter: Alle User, die dieses Projekt NOCH NICHT in ihrer Liste haben
    return this.allUsers().filter(user => !user.projectIds.includes(projId));
  });


  /**
   * 🔴 Event-Handler: Ein Kind meldet, dass ein User aus dem Projekt fliegen soll
   */
  public onRemoveUserFromProject(userId: string): void {
    const projId = this.selectedProjectId();
    if (!projId) return;

    // Aus dem Projekt löschen bedeutet im Service: deleteMember(projectId, userId)
    this.teamService.removeMemberFromProject(projId, userId);
  }
  /**
   * 🟢 Event-Handler: Ein Kind meldet, dass ein User zum Projekt hinzugefügt werden soll
   */
  public onAddUserToProject(userId: string): void {
    console.log("TeamAssigmentComponent:: onAddUserToProject start") 
    const projId = this.selectedProjectId();
    if (!projId) return;

    // Wir rufen deinen Service auf: updateMember(projectId, user)
    // Der Service weiß dann, dass er diesen User in das Projekt schieben muss!
    const user = this.allUsers().find(u => u.id === userId);
    if (user) {
    console.log("TeamAssigmentComponent:: onAddUserToProject call updateMember") 
      this.teamService.addMemberToProject(projId, user);
    }
  }

   /**
   * Dropdown-Wechsel abfangen
   */
  public onProjectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProjectId.set(value ? value : null);
  }
}