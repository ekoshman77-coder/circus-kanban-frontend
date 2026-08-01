import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop'; // 🚀 NEU
import { DepartmentService } from '../../../core/services/admin/department-service';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TeamService } from '../../../core/services/team/team-service';
import { IUser } from '../../../core/repositories/user-repository';
import { UserModel } from '../../../core/models/user-model';

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
  protected teamService = inject(TeamService);

  public departments = this.departmentService.departments;

  public allUsers = computed(() => {
    const search = this.filterService.searchTerm().toLowerCase().trim()
    return this.teamService.globalMembersSignal().map(member => member.user)
    .filter((user) => {
        return user.firstName.toLowerCase().includes(search) 
                || user.lastName.toLowerCase().includes(search)
                || user.username.toLowerCase().includes(search)
    })
  });

  // 🚀 Helfer-Signal: Filtert blitzschnell alle noch unbestätigten User für die Warteschleife heraus
  public unapprovedUsers = computed(() => 
    this.allUsers().filter(user => !user.isApproved)
  );

  public ngOnInit(): void {
    this.teamService.loadGlobalPool();
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
    // Wenn die Karte in derselben Liste liegengelassen wurde
    if (event.previousContainer === event.container) return;

    const user = event.item.data;
    const targetListId = event.container.id; // 🎯 Wo ist die Karte gelandet?

    // FALL 1: Ab in den Mülleimer! 🗑️
    if (targetListId === 'trash-list') {
      console.log(`🗑️ Lösche User via CDK: ${user.username}`);
      this.teamService.deleteMember(null, user.id);
    }

    // FALL 2: In eine der Abteilungs-Spalten gezogen! 🏢
    else if (targetListId.startsWith('dept-list-')) {
      // Wir schneiden das 'dept-list-' vorne ab, um die reine departmentId zu bekommen
      const targetDepartmentId = targetListId.replace('dept-list-', '');

      console.log(`🏢 Schalte User frei für Abteilung: ${targetDepartmentId}`);
      this.teamService.approveMember(user.id, targetDepartmentId);
    }
  }

  // Bleibt aktiv, falls der Admin das Dropdown in der Spalte benutzt[cite: 7, 8]
  public transferUser(userId: string, targetDepartmentId: string) {
    const userToUpdate = this.allUsers().find(u => u.id === userId);
    if (userToUpdate) {
      this.teamService.approveMember(userId, targetDepartmentId);
    }
  }
}