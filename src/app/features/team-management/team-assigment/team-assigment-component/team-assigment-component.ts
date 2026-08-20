import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamService } from '../../../../core/services/team/team-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProjectMembersListComponent } from '../project-members-list/project-members-list';
import { AvailablePoolListComponent } from '../available-pool-list/available-pool-list';
import { ProjectService } from '../../../../core/services/project/project-service';
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';
import { ProjectRole } from '../../../../core/models/user-model';
import { FormsModule } from '@angular/forms'; // 🎯 Wichtig fürs Dropdown-Binding!
import { MilestoneSelectorComponent } from '../../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { MasterDataService } from '../../../../core/services/admin/master-data-service';
import { UserSummary } from '../../../../core/models/user-summary';
import { ProjectMember } from '../../../../core/models/project-member';

@Component({
  selector: 'app-team-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule, ProjectMembersListComponent, AvailablePoolListComponent, MilestoneSelectorComponent],
  templateUrl: './team-assigment-component.html',
  styleUrl: './team-assigment-component.css'
})
export class TeamAssigmentComponent implements OnInit {
  private teamService = inject(TeamService);
  private projectService = inject(ProjectService);
  private masterDataService = inject(MasterDataService)

  private roleEmojiMap: Record<string, string> = {
    DEVELOPER: '👨‍💻',
    PROJECT_MANAGER: '👑',
    DESIGNER: '🎨',
    VIEWER: '👁️',
    OWNER: '🔑',
    TESTER: '🧪',
    SCRUM_MASTER: '🔄'
  };

  public selectedProjectId = signal<string | null>(null);

  public allProjects = computed(() => this.projectService.projectsList());
  public pool = this.teamService.globalMembersSignal;
  public projectRoles = this.masterDataService.projectRoles
  public newUsers = signal<ProjectMember[]>([])

  public allUsers = computed(() => {
    return [...this.pool(), ...this.newUsers()]
  })

  public activeMembers = computed(() => {
    return this.teamService.currentProjectMembersSignal();
  });

  // 📂 Zustand für das fliegende Rollen-Popup
  public showRoleModal = signal<boolean>(false);
  public userIdPendingAssignment = signal<string | null>(null);
  public selectedRoleForAssignment = signal<ProjectRole>('DEVELOPER'); // Standardwert im Dropdown

  ngOnInit(): void {
    console.log('👥 [TeamAssignment] Triggere globalen Pool im OnInit');
    this.teamService.loadGlobalPool();
  }
  constructor() {
    /**
     * 🎯 DER AUTOMATISCHE PROJEKT-TRIGGER
     * Sobald sich 'selectedProjectId' im Dropdown ändert, sagen wir dem
     * TeamService Bescheid, welcher dann das Projekt-Signal austauscht!
     */
    effect(() => {
      const projectId = this.selectedProjectId();
      console.log(`📂 [TeamAssignment] Dropdown gewechselt auf Projekt-ID: ${projectId}`);

      // Nutzt unsere saubere Methode im Service, die ID zu setzen & die Mitglieder zu laden!
      this.teamService.setCurrentProject(projectId);
    });
  }

  public getRoleEmoji(roleName: string): string {
     return this.roleEmojiMap[roleName]?? '👤' 
  }

  public availablePool = computed(() => {
    const projId = this.selectedProjectId();
    if (!projId) return this.allUsers();

    // Die aktiven IDs aus dem ProjectMember[] extrahieren
    const activeIds = this.activeMembers().map(m => m.user.id);

    // Nur User anzeigen, die noch NICHT im Projekt sind
    return this.allUsers().filter(member => !activeIds.includes(member.user.id));
  });

  public onRemoveUserFromProject(userId: string): void {
    const projId = this.selectedProjectId();
    if (!projId) return;
    this.teamService.removeMemberFromProject(projId, userId);
  }

  /**
   * 🟢 Fängt das Hinzufügen ab und öffnet das Popup, statt direkt zu speichern!
   */
  public onAddUserToProject(userId: string): void {
    // 🔍 1. Checken, ob der User bereits ein aktives Projektmitglied ist
    const alreadyMember = this.activeMembers().some(member => member.user.id === userId);

    // 🛡️ 2. Wenn er schon drin ist, brechen wir sofort ab – er hat seine Rolle ja schon!
    if (alreadyMember) {
      console.log(`ℹ️ [TeamAssignment] User ${userId} ist bereits im Projekt. Popup blockiert.`);
      return;
    }

    // 🚀 3. Nur wenn er neu ist (aus dem Pool kommt), zeigen wir das Rollen-Popup
    console.log(`✨ [TeamAssignment] Neuer User ${userId} wird hinzugefügt. Öffne Popup.`);
    this.userIdPendingAssignment.set(userId);
    this.selectedRoleForAssignment.set('DEVELOPER'); // Reset auf Standard
    this.showRoleModal.set(true); // Popup öffnen!
  }
  
  /**
   * 💾 Bestätigung im Popup: Jetzt wird die Rolle an den Service übergeben!
   */
  public onConfirmRoleAssignment(): void {
    const projId = this.selectedProjectId();
    const userId = this.userIdPendingAssignment();
    const role = this.selectedRoleForAssignment();

    if (!projId || !userId) return;

    const member = this.allUsers().find(m => m.user.id === userId);
    if (member) {
      this.teamService.addMemberToProject(projId, member.user, role);
    }

    this.onCloseRoleModal();
  }

  public onCloseRoleModal(): void {
    this.showRoleModal.set(false);
    this.userIdPendingAssignment.set(null);
  }

  public onProjectChange(projectId: string | null): void {
    this.selectedProjectId.set(projectId);

    if (projectId) {
      this.teamService.setCurrentProject(projectId)
    }
  }

  public onNewUsersAdded(users: UserSummary[]) {
     const existingIds = new Set(this.allUsers().map(member => member.user.id))
     const newAvailableUsers = users.filter(u => !existingIds.has(u.id)) 
     const members = newAvailableUsers.map(user => new ProjectMember(user))
     this.newUsers.update(value => [...value, ...members])
  }
}