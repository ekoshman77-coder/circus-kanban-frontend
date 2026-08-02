import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop'; // 🚀 NEU
import { DepartmentService } from '../../../core/services/admin/department-service';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TeamService } from '../../../core/services/team/team-service';
import { IUser } from '../../../core/repositories/user-repository';
import { UserModel } from '../../../core/models/user-model';
import { AdminTeamService } from '../../../core/services/admin/admin-team-service';

@Component({
  selector: 'app-admin-users-component',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule], // 🚀 DragDropModule hinzugefügt, Popup entfernt
  templateUrl: './admin-users-component.html',
  styleUrl: './admin-users-component.css',
})
export class AdminUsersComponent implements OnInit {
  protected departmentService = inject(DepartmentService);
  protected filterService = inject(FilterService);
  protected adminTeamService = inject(AdminTeamService);

  public departments = this.departmentService.departments;

public allUsers = computed(() => {
    const search = this.filterService.searchTerm().toLowerCase().trim();
    // 👑 Nutzt jetzt das isolierte Admin-Signal!
    return this.adminTeamService.adminUsersSignal().map(member => member.user)
    .filter((user) => {
        return user.firstName.toLowerCase().includes(search) 
                || user.lastName.toLowerCase().includes(search)
                || user.username.toLowerCase().includes(search);
    });
  });

  // 🚀 Helfer-Signal: Filtert blitzschnell alle noch unbestätigten User für die Warteschleife heraus
  public unapprovedUsers = computed(() => 
    this.allUsers().filter(user => !user.isApproved)
  );

  public ngOnInit(): void {
    this.adminTeamService.loadAdminPool();
  }

  // 🔍 REAKTIVE FILTER-METHODEN
  public filteredUsersForDept(departmentId: string): UserModel[] {
    return this.allUsers().filter(user => 
      user.departmentId === departmentId && user.isApproved
    );
  }

  public countUsersInDept(departmentId: string): number {
    return this.filteredUsersForDept(departmentId).length;
  }

  // 🎛️ DIE NEUE ZENTRALE DRAG-AND-DROP LOGIK
  public handleDrop(event: CdkDragDrop<UserModel[]>) {
    if (event.previousContainer === event.container) return;

    const user = event.item.data;
    const targetListId = event.container.id;

    if (targetListId === 'trash-list') {
      console.log(`🗑️ Lösche User via Admin-Service: ${user.username}`);
      // 👑 Aufruf über den neuen Service
      this.adminTeamService.deleteMember(user.id);
    }
    else if (targetListId.startsWith('dept-list-')) {
      const targetDepartmentId = targetListId.replace('dept-list-', '');
      console.log(`🏢 Schalte User frei via Admin-Service: ${targetDepartmentId}`);
      // 👑 Aufruf über den neuen Service
      this.adminTeamService.approveMember(user.id, targetDepartmentId);
    }
  }

  // Bleibt aktiv, falls der Admin das Dropdown in der Spalte benutzt[cite: 7, 8]
  public transferUser(userId: string, targetDepartmentId: string) {
    const userToUpdate = this.allUsers().find(u => u.id === userId);
    if (userToUpdate) {
      this.adminTeamService.approveMember(userId, targetDepartmentId);
    }
  }
}