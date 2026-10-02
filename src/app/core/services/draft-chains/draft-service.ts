import { computed, inject, Injectable } from '@angular/core';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { DelegationTarget } from '../../models/queue-items/draft-queue-payload';
import { SnapshotPayload } from '../../models/queue-items/queue-item';
import { DraftQueueDataManager } from './draft-data-manager';

@Injectable({
  providedIn: 'root'
})
export class DraftService extends BaseDataManager {
  private dataManager = inject(DraftQueueDataManager);

  /** Holt das rohe Signal aus dem DataManager */
  public readonly draftChains = this.dataManager.draftChainsSignal;



  // ==========================================
  // 🚀 ACTIONS (Reine Delegation an DataManager)
  // ==========================================

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

    const updatedDraft = new DraftChain(
      draft.id,
      draft.title,
      updatedItems,
      draft.createdAt,
      draft.origin,
      draft.createdByUserId,
      draft.lastErrorReason,
      draft.lastErrorCode,
      draft.target,
      draft.delegatedByUserId,
      draft.note
    );

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