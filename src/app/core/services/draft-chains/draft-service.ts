import { computed, inject, Injectable } from '@angular/core';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { DelegationTarget } from '../../models/queue-items/draft-queue-payload';
import { SnapshotPayload } from '../../models/queue-items/queue-item';
import { DraftQueueDataManager } from './draft-data-manager';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { Observable, of } from 'rxjs';
import { UserService } from '../user/user-service';

export interface SandboxSummary {
  totalChains: number;
  notesCount: number;
  todosCount: number;
  projectsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class DraftService extends BaseDataManager {
  private dataManager = inject(DraftQueueDataManager);
  private userService = inject(UserService)

  /** Holt das rohe Signal aus dem DataManager */
  public readonly draftChains = this.dataManager.draftChainsSignal;

// ==========================================
  // 🎓 GRADUATION & SANDBOX COMPUTEDS
  // ==========================================

  /** Alle un-synchronisierten Entwürfe aus der Labor-Zeit */
  public readonly laborDrafts = computed(() =>
    this.draftChains().filter(chain => chain.origin === 'LABOR')
  );

  /** Berechnete Zusammenfassung für die UI (z. B. Graduation Modal) */
  public readonly sandboxSummary = computed<SandboxSummary>(() => {
    const drafts = this.laborDrafts();
    let notesCount = 0;
    let todosCount = 0;
    let projectsCount = 0;

    drafts.forEach(chain => {
      chain.items.forEach(item => {
        const service = item.queueItem.serviceName;
        if (service === QueueHandlerName.NOTE) notesCount++;
        if (service === QueueHandlerName.TODO) todosCount++;
        if (service === QueueHandlerName.PROJECT) projectsCount++
      });
    });

    return {
      totalChains: drafts.length,
      notesCount,
      todosCount,
      projectsCount
    };
  });

  // ==========================================
  // 🚀 ACTIONS (Reine Delegation an DataManager)
  // ==========================================

  public promoteLaborDraftsToRealWorld(): void {
    this.dataManager.promoteLaborDraftsToRealWorld();
  }

  public delegateAllLaborDraftsToSupervisor(note?: string): Observable<boolean> {
    if (this.laborDrafts().length === 0) {
      return of(true);
    }

    console.log(`🎓 [DraftService] Bündele ${this.laborDrafts().length} Entwurfsketten zu EINEM Gesamt-Paket...`);
    
    const target: DelegationTarget = {
      type: 'USER',
      id: this.userService.currentUser()?.supervisorId?? ""
    }

    this.dataManager.delegateAllLaborDraftsAsSinglePackage(target, note);
    
    return of(true);
  }

  public getDraftChain(id: string): DraftChain | null {
    return this.draftChains().find(chain => chain.id === id) || null;
  }

  public reinjectDraftChain(draftId: string, updatedItems?: DraftChainItem[]): void {
    this.dataManager.reinjectDraftChain(draftId, updatedItems);
  }

  public delegateDraftChain(chainId: string, target: DelegationTarget, note?: string): void {
    this.dataManager.delegateDraftChain(chainId, target, note);
  }

  public removeDraftChain(chainId: string): void {
    this.dataManager.removeDraftChain(chainId);
  }

  public updateDraftItemPayload(draftId: string, itemId: string, updatedPayload: SnapshotPayload): void {
    const draft = this.getDraftChain(draftId);
    if (!draft) return;

    const updatedItems = draft.items.map(item => {
      if (item.queueItem.id !== itemId) return item;
      return {
        ...item,
        queueItem: {
          ...item.queueItem,
          payload: updatedPayload
        }
      };
    });

    const updatedDraft = new DraftChain({
      id: draft.id,
      title: draft.title,
      items: updatedItems,
      createdAt: draft.createdAt,
      origin: draft.origin,
      createdByUserId: draft.createdByUserId,
      lastErrorReason: draft.lastErrorReason,
      lastErrorCode: draft.lastErrorCode,
      target: draft.target,
      delegatedByUserId: draft.delegatedByUserId,
      note: draft.note
  });

    // Sauber über den DataManager speichern!
    this.dataManager.saveDraftChain(updatedDraft);
  }

  // ==========================================
  // 📝 BASE DATA MANAGER HOOKS
  // ==========================================

  /** Alle Entwürfe, chronologisch nach Erstellungsdatum sortiert (neueste zuerst) */
  public readonly sortedDraftChains = computed(() =>
    [...this.draftChains()].sort((a, b) => b.createdAt - a.createdAt)
  );

  private readonly localDrafts = computed(() =>
    this.sortedDraftChains().filter(chain => chain.origin === 'LOCAL')
  );

  public override checkUnsavedData(): string | null {
    if (this.localDrafts().length > 0) {
      return 'Es gibt noch ungespeicherte lokale Entwürfe.';
    }
    return null;
  }

  public override resetData(): void {
    // Falls beim Reset UI-Daten bereinigt werden müssen
  }
}