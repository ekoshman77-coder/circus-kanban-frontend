import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamService } from '../../../../core/services/team/team-service';
import { ProjectMembersListComponent } from '../project-members-list/project-members-list';
import { AvailablePoolListComponent } from '../available-pool-list/available-pool-list';
import { ProjectService } from '../../../../core/services/project/project-service';
import { ProjectRole } from '../../../../core/models/user-model';
import { FormsModule } from '@angular/forms';
import { MilestoneSelectorComponent } from '../../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { MasterDataService } from '../../../../core/services/admin/master-data-service';
import { UserSummary } from '../../../../core/models/user-summary';
import { ProjectMember } from '../../../../core/models/project-member';
import { NotificationService } from '../../../../core/services/notification/notification-service';
import { DragDropModule } from '@angular/cdk/drag-drop'; // 👈 CDK Import für cdkDropListGroup
import { SelectRoleModal } from '../../../../core/shared/components/select-role-modal/select-role-modal';

@Component({
  selector: 'app-team-assignment',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ProjectMembersListComponent, 
    AvailablePoolListComponent, 
    MilestoneSelectorComponent,
    DragDropModule, 
    SelectRoleModal
  ],
  templateUrl: './team-assigment-component.html',
  styleUrl: './team-assigment-component.css'
})
export class TeamAssigmentComponent implements OnInit {
  private teamService = inject(TeamService);
  private projectService = inject(ProjectService);
  private masterDataService = inject(MasterDataService);
  private notificationService = inject(NotificationService);

  public roleEmojiMap: Record<string, string> = {
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
  public projectRoles = this.masterDataService.projectRoles;
  public newUsers = signal<ProjectMember[]>([]);

  public allUsers = computed(() => {
    return [...this.pool(), ...this.newUsers()];
  });

  public activeMembers = computed(() => {
    return this.teamService.currentProjectMembersSignal();
  });

  public showRoleModal = signal<boolean>(false);
  public userIdPendingAssignment = signal<string | null>(null);
  public selectedRoleForAssignment = signal<ProjectRole>('DEVELOPER');

  ngOnInit(): void {
    console.log('👥 [TeamAssignment] Triggere globalen Pool im OnInit');
    this.teamService.loadGlobalPool();
  }

  constructor() {
    effect(() => {
      const projectId = this.selectedProjectId();
      console.log(`📂 [TeamAssignment] Dropdown gewechselt auf Projekt-ID: ${projectId}`);
      this.teamService.setCurrentProject(projectId);
    });
  }

  public getRoleEmoji(roleName: string): string {
     return this.roleEmojiMap[roleName] ?? '👤';
  }

  public availablePool = computed(() => {
    const projId = this.selectedProjectId();
    if (!projId) return this.allUsers();

    const activeIds = this.activeMembers().map(m => m.user.id);
    return this.allUsers().filter(member => !activeIds.includes(member.user.id));
  });

  public onRemoveUserFromProject(userId: string): void {
    const projId = this.selectedProjectId();
    if (!projId) return;
    this.newUsers.update(current => current.filter(u => u.user.id !== userId))
    this.teamService.removeMemberFromProject(projId, userId);    
  }

  public onAddUserToProject(userId: string): void {
    const alreadyMember = this.activeMembers().some(member => member.user.id === userId);

    if (alreadyMember) {
      console.log(`ℹ️ [TeamAssignment] User ${userId} ist bereits im Projekt. Popup blockiert.`);
      return;
    }

    console.log(`✨ [TeamAssignment] Neuer User ${userId} wird hinzugefügt. Öffne Popup.`);
    this.userIdPendingAssignment.set(userId);
    this.selectedRoleForAssignment.set('DEVELOPER');
    this.showRoleModal.set(true);
  }
  
  public onConfirmRoleAssignment(): void {
    console.log("onConfirmRoleAssignment")
    const projId = this.selectedProjectId();
    const userId = this.userIdPendingAssignment();
    const role = this.selectedRoleForAssignment();

    console.log("onConfirmRoleAssignment userId", userId)
    console.log("onConfirmRoleAssignment role", role)

    if (!projId || !userId) return;

    const member = [...this.allUsers(), ...this.activeMembers()].find(m => m.user.id === userId);
    console.log("onConfirmRoleAssignment member", member)

    if (member) {
      this.newUsers.update(value => value.filter(m => m.user.id !== userId))
      this.teamService.addMemberToProject(projId, member.user, role);
    }

    this.onCloseRoleModal();
  }

  public onBadgeClicked(userId: string) {
    console.log(`ℹ️ [TeamAssignment] onBadgeClicked: userId ${userId}`);
    const alreadyMember = this.activeMembers().find(member => member.user.id === userId);

    if (!alreadyMember) {
      console.log(`ℹ️ [TeamAssignment] User ${userId} ist noch nicht im Projekt. Popup blockiert.`);
      return;
    }

    this.userIdPendingAssignment.set(userId);
    this.selectedRoleForAssignment.set(alreadyMember.projectRole);
    this.showRoleModal.set(true);
  }

  public onCloseRoleModal(): void {
    this.showRoleModal.set(false);
    this.userIdPendingAssignment.set(null);
  }

  public onProjectChange(projectId: string | null): void {
    this.selectedProjectId.set(projectId);

    if (projectId) {
      this.teamService.setCurrentProject(projectId);
    }
  }

  public onNewUsersAdded(users: UserSummary[]) {
     const existingIds = new Set(this.allUsers().map(member => member.user.id));
     const newAvailableUsers = users.filter(u => !existingIds.has(u.id));
     const members = newAvailableUsers.map(user => new ProjectMember(user));
     this.newUsers.update(value => [...value, ...members]);
  }

  public removeUserFromPool(userId: string) {
    console.log("removeUserFromPool", userId);
    const user = this.pool().find(m => m.user.id === userId);
    if (user) {
      console.warn("⚠️ Globale Pool-Mitarbeiter können nicht aus der Liste gelöscht werden:", userId);
      this.notificationService.showNotification(
        'Globale Stammdaten-Mitarbeiter können nicht aus der Wartebank gelöscht werden.', 'info'
      );
      return;
    }
    const updatedList = this.newUsers().filter(m => m.user.id !== userId);
    this.newUsers.set(updatedList);
  }
}