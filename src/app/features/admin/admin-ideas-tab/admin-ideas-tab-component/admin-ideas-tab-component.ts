import { Component, signal } from '@angular/core';

export type AdminIdeaBoardTabName = 'departments-idea' | 'companies-idea'

@Component({
  selector: 'app-admin-ideas-tab-component',
  imports: [],
  templateUrl: './admin-ideas-tab-component.html',
  styleUrl: './admin-ideas-tab-component.css',
})
export class AdminIdeasTabComponent {
  protected activeTab = signal<AdminIdeaBoardTabName>('departments-idea') 

  public onTabClick(newTab: AdminIdeaBoardTabName) {
      this.activeTab.set(newTab)
  }
}
