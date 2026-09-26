import { Component, computed, inject, signal } from '@angular/core';
import { DelegateUser, DelegationTargetType, DraftUIService, UserProject } from '../draft-ui-service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-draft-box-component',
  imports: [DatePipe],
  templateUrl: './draft-box-component.html',
  styleUrl: './draft-box-component.css',
})
export class DraftBoxComponent {
  public draftUIService = inject(DraftUIService);

  public count = this.draftUIService.chainsCount;
  public chains = this.draftUIService.failureChains;
  public openedChain = signal<string | null>(null);

  // 🎯 LOKALER UI-STATE FOR INTERVIEW
  public activeDelegatingChainId = signal<string | null>(null);
  public currentStep = signal('CLOSED');
  
  public selectedTargetType = signal<DelegationTargetType | null>(null);
  public selectedProject = signal<UserProject | null>(null);
  public searchQuery = signal<string>('');

  // 🔍 Gefilterte & A-Z sortierte User-Liste aus dem Service
  public filteredUsers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = [...this.draftUIService.availableUsers()].sort((a, b) => a.name.localeCompare(b.name));
    
    if (!query) return list;
    return list.filter(u => u.name.toLowerCase().includes(query));
  });

  // --- INTERVIEW FLOW METHODEN ---

  public startTargetSelect(chainId: string): void {
    this.activeDelegatingChainId.set(chainId);
    this.currentStep.set('SELECT_TARGET');
    this.selectedTargetType.set(null);
    this.selectedProject.set(null);
    this.searchQuery.set('');
  }

  public onTargetSelected(targetType: DelegationTargetType): void {
    this.selectedTargetType.set(targetType);

    if (targetType === 'ADMINS') {
      this.executeDelegation({ targetType: 'ADMINS' });
    } else if (targetType === 'DEPARTMENT') {
      const depId = this.draftUIService.userContext().departmentId;
      this.executeDelegation({ targetType: 'DEPARTMENT', targetId: depId });
    } else if (targetType === 'PROJECT') {
      this.startProjectSelect();
    } else if (targetType === 'USER') {
      this.startUserSelect();
    }
  }

  public startProjectSelect(): void {
    const projects = this.draftUIService.userContext().projects;
    
    if (projects.length === 1) {
      this.onProjectSelected(projects[0]);
    } else {
      this.currentStep.set('SELECT_PROJECT');
    }
  }

  public onProjectSelected(project: UserProject): void {
    this.selectedProject.set(project);

    this.executeDelegation({
      targetType: 'PROJECT',
      targetId: project.id,
      projectId: project.id
    });
  }

  public startUserSelect(): void {
    this.currentStep.set('SELECT_USER');
  }

  public onUserSelected(user: DelegateUser): void {
    this.draftUIService.setFavoriteUser(user);
    
    this.executeDelegation({
      targetType: this.selectedTargetType()!,
      targetId: user.id,
      projectId: this.selectedProject()?.id
    });
  }

  private executeDelegation(payload: { targetType: DelegationTargetType; targetId?: string; projectId?: string }): void {
    const chainId = this.activeDelegatingChainId();
    if (!chainId) return;

    this.draftUIService.packAndSend(
      chainId, 
      payload.targetId || payload.targetType, 
      payload.targetType, 
      payload.projectId
    );
    
    this.cancelDelegation();
  }

  public cancelDelegation(): void {
    this.activeDelegatingChainId.set(null);
    this.currentStep.set('CLOSED');
    this.searchQuery.set('');
  }

  public onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  public tryAgain(chainId: string) {
    this.draftUIService.startAgain(chainId);
  }

  public openEditModal(chainId: string) {
  // Das Modal direkt im Service öffnen ohne Umwege über Accordion-Toggles
    this.draftUIService.openEditModal(chainId);    
  }

  public deleteChain(chainId: string) {
    if (this.openedChain() === chainId) {
      this.openedChain.set(null)
    }
    this.draftUIService.delete(chainId);
  }

  public toggleChainDetails(chainId: string) {
    this.openedChain.update(current => current === chainId ? null : chainId);
  }

  public closeDrawer(): void {
    this.draftUIService.closeDraftBox();
  }
}