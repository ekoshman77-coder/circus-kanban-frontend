import { Component, signal } from '@angular/core';
import { DepartmentTabComponent } from '../departments-component/departments-component';
import { AdminUsersComponent } from '../admin-users-component/admin-users-component';
import { PermissionsComponent } from '../permissions-component/permissions-component';
import { NgClass } from '@angular/common';
import { AdminIdeasTabComponent } from '../admin-ideas/admin-ideas-tab-component/admin-ideas-tab-component';
import { AdminProjectBoardComponent } from '../projects/admin-project-board-component/admin-project-board-component';
import { AdminTodoBoardComponent } from '../todos/admin-todo-board-component/admin-todo-board-component';

export type AdminBoardTabs = 'departments' | 'users' | 'permissions' | 'ideas' | 'projects' | 'todos';
@Component({
  selector: 'app-admin-board-component',
  imports: [NgClass, 
    DepartmentTabComponent, 
    AdminUsersComponent, PermissionsComponent, 
    AdminIdeasTabComponent, 
    AdminProjectBoardComponent, 
    AdminTodoBoardComponent
  ],
  templateUrl: './admin-board-component.html',
  styleUrl: './admin-board-component.css',
})
export class AdminBoardComponent {
activeTab = signal<AdminBoardTabs>('departments');

  changeTab(tab: AdminBoardTabs) {
    this.activeTab.set(tab);
  }
}
