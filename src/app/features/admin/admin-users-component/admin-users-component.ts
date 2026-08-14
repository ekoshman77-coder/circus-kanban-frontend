import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { DepartmentService } from '../../../core/services/admin/department-service';
import { FilterService } from '../../../core/services/filter/filter-service';
import { UserModel } from '../../../core/models/user-model';
import { AdminTeamService } from '../../../core/services/admin/admin-team-service';
import { MasterDataService } from '../../../core/services/admin/master-data-service';
import { Department } from '../../../core/models/department';
import { RoleSelectionModalComponent } from '../../../core/shared/components/role-selection-modal/role-selection-modal';

@Component({
  selector: 'app-admin-users-component',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, RoleSelectionModalComponent],
  templateUrl: './admin-users-component.html',
  styleUrl: './admin-users-component.css',
})
export class AdminUsersComponent implements OnInit {
  protected departmentService = inject(DepartmentService);
  protected filterService = inject(FilterService);
  protected adminTeamService = inject(AdminTeamService);
  protected masterDataService = inject(MasterDataService); // 👈 MasterDataService injizieren

  public departments = this.departmentService.departments;

  // 🔮 MODAL STATE
  public isRoleModalOpen = signal(false);
  public modalTitle = signal('Rolle zuweisen');
  public modalMessage = signal('');

  // Temporäre Speicherung für den ausstehenden Transfer
  public pendingUser = signal<UserModel | null>(null);
  private pendingDeptId = signal<string | null>(null);

  public allUsers = computed(() => {
    const search = this.filterService.searchTerm().toLowerCase().trim();
    return this.adminTeamService.adminUsersSignal()
      .map(member => member.user)
      .filter((user) => {
        return user.firstName.toLowerCase().includes(search)
          || user.lastName.toLowerCase().includes(search)
          || user.username.toLowerCase().includes(search);
      });
  });

  public unapprovedUsers = computed(() =>
    this.allUsers().filter(user => !user.isApproved)
  );

  public approvedUsersByDept = computed(() => {
    const map = new Map<string, UserModel[]>();
    const users = this.allUsers().filter(u => u.isApproved);

    for (const user of users) {
      const deptId = user.department?.id;
      if (deptId) {
        if (!map.has(deptId)) map.set(deptId, []);
        map.get(deptId)!.push(user);
      }
    }
    return map;
  });

  public ngOnInit(): void {
    this.adminTeamService.loadAdminPool();
    this.masterDataService.loadMasterData(); // 👈 Masterdata laden
  }

  public getUsersForDept(departmentId: string): UserModel[] {
    return this.approvedUsersByDept().get(departmentId) || [];
  }

  public selectedDepartment = signal<Department | null>(null);

public filteredRoles = computed(() => {
  const dept = this.selectedDepartment();
  if (!dept) return [];

  // Direkter Zugriff auf das string[] aus MasterData
  const allRoles = this.masterDataService.departmentRoles();

  if (dept.isAdmin()) {
    return allRoles.filter(role => role.toLowerCase().includes('admin'));
  } else {
    return allRoles.filter(role => !role.toLowerCase().includes('admin'));
  }
});

  public handleDrop(event: CdkDragDrop<UserModel[]>) {
    if (event.previousContainer === event.container) return;

    const user: UserModel = event.item.data;
    const targetListId = event.container.id;

    if (targetListId === 'trash-list') {
      if (confirm(`Möchtest du ${user.firstName} ${user.lastName} wirklich löschen/ablehnen?`)) {
        this.adminTeamService.deleteMember(user.id);
      }
    }
    else if (targetListId.startsWith('dept-list-')) {
      const targetDepartmentId = targetListId.replace('dept-list-', '');
      const dept = this.departments().find(d => d.id === targetDepartmentId);

      if (dept) {
        // Modal vorbereiten & öffnen
        this.pendingUser.set(user);
        this.selectedDepartment.set(dept);

        this.modalTitle.set(`Rolle zuweisen (${dept.name})`);
        this.modalMessage.set(`Welche Rolle soll ${user.firstName} ${user.lastName} in "${dept.name}" erhalten?`);

        this.isRoleModalOpen.set(true); // 👈 Modal öffnen
      }
    }
  }

  // ⚡ Klick auf Rollen-Badge/Button auf der Karte (Fall B)
  public openRoleChangeModal(user: UserModel) {
    if (!user.department) return;

    this.pendingUser.set(user);
    this.pendingDeptId.set(user.department.id);
    this.selectedDepartment.set(user.department)
    
    this.modalTitle.set(`Rolle ändern`);
    this.modalMessage.set(`Wähle eine neue Rolle für ${user.firstName} ${user.lastName}:`);

    this.isRoleModalOpen.set(true);
  }

  // ✅ Wird aufgerufen, wenn im Modal eine Rolle angeklickt wurde
public onRoleConfirmed(selectedRole: string) {
  console.log('2️⃣ [PARENT] RoleConfirmed empfangen:', selectedRole);

  const user = this.pendingUser();
  const dept = this.selectedDepartment();

  console.log('3️⃣ [PARENT] User:', user?.username, 'Abteilung:', dept?.name);

  if (user && dept) {
    console.log('4️⃣ [PARENT] Sendet an approveMember:', user.id, dept.name, selectedRole);
    this.adminTeamService.approveMember(user.id, dept, selectedRole);
  } else {
    console.warn('⚠️ [PARENT] User oder Department ist NULL!', { user, dept });
  }

  this.resetPendingState();
}

  // ❌ Wird aufgerufen, wenn im Modal abgebrochen wurde
  public onRoleCancelled() {
    this.resetPendingState();
  }

  private resetPendingState() {
    this.pendingUser.set(null);
    this.pendingDeptId.set(null);
  }

  public transferUser(userId: string, targetDepartmentId: string) {
    const deptObj = this.departments().find(d => d.id === targetDepartmentId);
    if (deptObj) {
      // Wenn man per Dropdown wechselt, öffnet sich ebenfalls der Rollen-Dialog oder nimmt Fallback
      const user = this.allUsers().find(u => u.id === userId);
      if (user) {
        this.pendingUser.set(user);
        this.pendingDeptId.set(deptObj.id);
        this.modalTitle.set(`Rolle zuweisen (${deptObj.name})`);
        this.modalMessage.set(`Welche Rolle soll ${user.firstName} ${user.lastName} erhalten?`);
        this.isRoleModalOpen.set(true);
      }
    }
  }
}