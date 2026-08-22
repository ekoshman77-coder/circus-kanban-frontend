import { Component, signal } from '@angular/core';
import { DepartmentTabComponent } from '../departments-component/departments-component';
import { AdminUsersComponent } from '../admin-users-component/admin-users-component';
import { PermissionsComponent } from '../permissions-component/permissions-component';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-admin-board-component',
  imports: [NgClass, DepartmentTabComponent, AdminUsersComponent, PermissionsComponent],
  templateUrl: './admin-board-component.html',
  styleUrl: './admin-board-component.css',
})
export class AdminBoardComponent {
activeTab = signal<'departments' | 'users' | 'permissions'>('departments');

  changeTab(tab: 'departments' | 'users' | 'permissions') {
    this.activeTab.set(tab);
  }
}
