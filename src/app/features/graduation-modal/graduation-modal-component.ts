import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DraftService } from '../../core/services/draft-chains/draft-service';
import { UserStatusPollingService } from '../../core/services/admin/user-status-polling-service';

export type WizardStep = 'OVERVIEW' | 'CONFIRM_DISCARD' | 'PROCESSING' | 'SUCCESS';

@Component({
  selector: 'app-graduation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graduation-modal-component.html',
  styleUrls: ['./graduation-modal-component.css']
})
export class GraduationModalComponent {
  public draftService = inject(DraftService);
  public pollingService = inject(UserStatusPollingService);

  // Status des Wizards: OVERVIEW | CONFIRM_DISCARD | PROCESSING | SUCCESS
  public currentStep = signal<WizardStep>('OVERVIEW');
  public showDetails = signal<boolean>(false);

  // Test-Daten fürs erste Anschauen
  constructor() {
    if (!this.pollingService.graduationPending()) {
      this.pollingService.graduationPending.set({
        user: {
          id: 'test-user-123',
          firstName: 'Alex',
          lastName: 'Muster',
          departmentRole: 'MEMBER',
          isApproved: true
        } as any,
        source: 'LIVE_POLLING'
      });
    }
  }

  public itemCounts = this.draftService.sandboxSummary;
  public laborDrafts = this.draftService.laborDrafts;

  public toggleDetails(): void {
    this.showDetails.update(v => !v);
  }

  // 🚀 Aktionen ausführen
  public async onPromoteToRealWorld(): Promise<void> {
    this.currentStep.set('PROCESSING');
    
    // Kurze künstliche Verzögerung für geschmeidiges UI-Feedback
    setTimeout(() => {
      this.draftService.promoteLaborDraftsToRealWorld();
      this.currentStep.set('SUCCESS');
    }, 800);
  }

  public onKeepAsDrafts(): void {
    this.currentStep.set('PROCESSING');
    
    setTimeout(() => {
      this.pollingService.dismissGraduation();
      this.currentStep.set('OVERVIEW');
    }, 500);
  }

  public askForDiscardConfirmation(): void {
    this.currentStep.set('CONFIRM_DISCARD');
  }

  public onConfirmDiscard(): void {
    this.draftService.resetData();
    this.pollingService.dismissGraduation();
    this.currentStep.set('OVERVIEW');
  }

  public onCancelDiscard(): void {
    this.currentStep.set('OVERVIEW');
  }

  public onCloseWizard(): void {
    this.pollingService.dismissGraduation();
    this.currentStep.set('OVERVIEW');
  }
}