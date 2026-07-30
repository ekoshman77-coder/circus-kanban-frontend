import { Component, signal } from '@angular/core';
import { DepartmentTabComponent } from '../departments-component/departments-component';
import { AdminUsersComponent } from '../admin-users-component/admin-users-component';

@Component({
  selector: 'app-admin-board-component',
  imports: [DepartmentTabComponent, AdminUsersComponent],
  templateUrl: './admin-board-component.html',
  styleUrl: './admin-board-component.css',
})
export class AdminBoardComponent {
activeTab = signal<'departments' | 'users'>('departments');

  changeTab(tab: 'departments' | 'users') {
    this.activeTab.set(tab);
  }
}
