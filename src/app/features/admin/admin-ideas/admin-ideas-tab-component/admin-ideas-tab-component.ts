import { Component, computed, signal } from '@angular/core';
import { BoardMode, IdeaBoardComponent } from '../../../idea-board/idea-board-component/idea-board-component';

export type AdminIdeaBoardTabName = 'departments-idea' | 'companies-idea'

@Component({
  selector: 'app-admin-ideas-tab-component',
  imports: [IdeaBoardComponent],
  templateUrl: './admin-ideas-tab-component.html',
  styleUrl: './admin-ideas-tab-component.css',
})
export class AdminIdeasTabComponent {
  protected activeTab = signal<AdminIdeaBoardTabName>('departments-idea') 

  // 🟢 Erzeugt reaktiv den passenden BoardMode
  protected currentBoardMode = computed<BoardMode>(() => {
    return this.activeTab() === 'departments-idea' 
      ? 'ADMIN_DEPARTMENTS' 
      : 'ADMIN_COMPANY';
  });
  
  public onTabClick(newTab: AdminIdeaBoardTabName) {
      this.activeTab.set(newTab)
  }
}
