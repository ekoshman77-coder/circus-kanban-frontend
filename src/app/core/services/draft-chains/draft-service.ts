import { Injectable, signal, computed, inject } from '@angular/core';
import { IDraftService } from './draft-service-interface';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { CentralQueueService } from '../central-queue/central-queue-service';

@Injectable({
  providedIn: 'root'
})
export class DraftService implements IDraftService {
  private queueService = inject(CentralQueueService)
  private readonly STORAGE_KEY = 'global_draft_chains_store';

  // State Management via Signals
  private draftChainsSignal = signal<DraftChain[]>([]);
  public readonly draftChains = this.draftChainsSignal.asReadonly();
  public readonly draftCount = computed(() => this.draftChainsSignal().length);

  constructor() {
    this.loadFromStorage();
    // 🎧 Lauscht auf das Signal des CentralQueueService
    this.queueService.queueFailed$.subscribe(({ items, error, errorCode }) => {
      this.createDraftFromFailedQueue(items, error, errorCode);
    });
  }

  createDraftFromFailedQueue(items: QueueItem<SnapshotPayload<any>>[], error: string, errorCode: number) {
    const customTitle = this.createCustomTitle(items);
    this.saveDraftChain(items, error, errorCode, customTitle);
  }

  private createCustomTitle(items: QueueItem[]): string {
    const itemName = `${items[0].payload.displayInfo.title} ${items[0].payload.displayInfo.category}`;
    return itemName
  }

  public saveDraftChain(items: QueueItem[], errorReason: string, errorCode: number, customTitle?: string): void {
    if (!items || items.length === 0) return;

    const draftItems: DraftChainItem[] = items.map((item, index) => ({
      queueItem: structuredClone(item), 
      isRootCause: index === 0         
    }));

    const newDraft: DraftChain = {
      id: `draft_\({Date.now()}_\){Math.random().toString(36).substring(2, 7)}`, 
      title: customTitle || items[0].action || 'Fehlerhafte Operation', 
      items: draftItems,
      createdAt: Date.now(), 
      lastErrorReason: errorReason, 
      lastErrorCode: errorCode
    };

    this.draftChainsSignal.update(chains => [newDraft, ...chains]);
    this.persistToStorage(); 
  }

  public getDraftChain(id: string): DraftChain | null {
    return this.draftChainsSignal().find(chain => chain.id === id) || null;
  }

  public updateDraftItemPayload(draftId: string, itemId: string, updatedPayload: SnapshotPayload): void {
    this.draftChainsSignal.update(chains =>
      chains.map(chain => {
        if (chain.id !== draftId) return chain;

        const updatedItems = chain.items.map(item => {
          if (item.queueItem.id !== itemId) return item;
          return {
            ...item,
            queueItem: {
              ...item.queueItem,
              payload: updatedPayload
            }
          };
        });

        return { ...chain, items: updatedItems };
      })
    );
    this.persistToStorage();
  }

  public reinjectDraftChain(draftId: string): void {
    const draft = this.getDraftChain(draftId);
    if (!draft) {
      console.warn(`⚠️ [DraftService] Draft mit ID "${draftId}" nicht gefunden.`);
      return;
    }

    // 2. Über den Stream an den CentralQueueService feuern
    console.log(`🔄 [DraftService] Sende Draft "${draftId}" zum Re-Inject...`);
    draft.items.forEach(item => {
      this.queueService.enqueue(item.queueItem.serviceName, item.queueItem.action, item.queueItem.payload)
    });
    // 3. Aus der Draft-Box entfernen
    this.removeDraftChain(draftId);
  }

  public removeDraftChain(id: string): void {
    this.draftChainsSignal.update(chains => chains.filter(c => c.id !== id));
    this.persistToStorage();
  }

  public clearAllDrafts(): void {
    this.draftChainsSignal.set([]);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private persistToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.draftChainsSignal()));
    } catch (err) {
      console.error('❌ [DraftService] Fehler beim Speichern im LocalStorage:', err);
    }
  }

  private loadFromStorage(): void {
    const rawData = localStorage.getItem(this.STORAGE_KEY);
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        this.draftChainsSignal.set(parsed);
      } catch (err) {
        console.error('❌ [DraftService] Fehler beim Laden aus LocalStorage:', err);
        this.draftChainsSignal.set([]);
      }
    }
  }
}