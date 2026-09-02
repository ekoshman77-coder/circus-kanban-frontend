import { Component, signal } from '@angular/core';
import { DepartmentTabComponent } from '../departments-component/departments-component';
import { AdminUsersComponent } from '../admin-users-component/admin-users-component';
import { PermissionsComponent } from '../permissions-component/permissions-component';
import { NgClass } from '@angular/common';
import { AdminIdeasTabComponent } from '../admin-ideas/admin-ideas-tab-component/admin-ideas-tab-component';

@Component({
  selector: 'app-admin-board-component',
  imports: [NgClass, DepartmentTabComponent, AdminUsersComponent, PermissionsComponent, AdminIdeasTabComponent],
  templateUrl: './admin-board-component.html',
  styleUrl: './admin-board-component.css',
})
export class AdminBoardComponent {
activeTab = signal<'departments' | 'users' | 'permissions' | 'ideas'>('departments');

  changeTab(tab: 'departments' | 'users' | 'permissions' | 'ideas') {
    this.activeTab.set(tab);
  }
}
