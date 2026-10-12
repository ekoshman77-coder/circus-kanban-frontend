// src/app/core/services/central-queue/labor-central-queue.service.ts

import { Injectable, signal } from '@angular/core';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import { BaseCentralQueueService } from './base-central-queue-service';
import { DraftChain } from '../../models/draft-chain';
import { DelegationTarget } from '../../models/queue-items/draft-queue-payload';
import { IQueueHandler } from './queue-handler-interface';
import { catchError, concatMap, finalize, from, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LaborCentralQueueService extends BaseCentralQueueService {
  private readonly LABOR_ACTIVE_KEY = 'global_labor_active_chains';
  private readonly LABOR_STAGED_KEY = 'global_labor_staged_delegations';

  public activeChains = signal<DraftChain[]>([]);
  public stagedDelegations = signal<DraftChain[]>([]);

  constructor(registry: Map<QueueHandlerName, IQueueHandler>) {
    super(registry);
    // 💾 Gespeicherten Sandbox-State beim Instanziieren sofort wiederherstellen!
    this.restoreFromLocalStorage(); 
  }
  
  /**
   * 💾 Lädt gespeicherte Labor-Zustände aus dem LocalStorage
   */
  private restoreFromLocalStorage(): void {
    const rawActive = this.localStorageService.getItem<DraftChain[]>(this.LABOR_ACTIVE_KEY) || [];
    const rawStaged = this.localStorageService.getItem<DraftChain[]>(this.LABOR_STAGED_KEY) || [];

    const activeChains = rawActive.map((dto: any) => DraftChain.fromJson(dto));
    const stagedChains = rawStaged.map((dto: any) => DraftChain.fromJson(dto));

    this.activeChains.set(activeChains);
    this.stagedDelegations.set(stagedChains);
  }

  /**
   * 💾 Persistiert den aktuellen Signal-Zustand im LocalStorage
   */
  private persistLaborData(): void {
    const activeDtos = this.activeChains().map(chain => chain.toJson());
    const stagedDtos = this.stagedDelegations().map(chain => chain.toJson());

    this.localStorageService.setItem(this.LABOR_ACTIVE_KEY, activeDtos);
    this.localStorageService.setItem(this.LABOR_STAGED_KEY, stagedDtos);
  }

public override enqueue(serviceName: QueueHandlerName, action: string, payload: SnapshotPayload): QueueItem {
    const newItem: QueueItem = {
      id: generateLocalId(),
      serviceName,
      action,
      payload,
      timestamp: Date.now()
    };

    // 🚀 BYPASS: Wenn ein Entwurf an den Supervisor delegiert wird,
    // führen wir das Item SOFORT live über den registrierten Handler aus!
    if (serviceName === QueueHandlerName.DRAFT && action === 'DELEGATE_DRAFT') {
      const handler = this.registry.get(serviceName);
      if (handler) {
        console.log(`🚀 [Labor-Modus Bypass] DELEGATE_DRAFT wird direkt ans Backend gefeuert!`);
        handler.executeQueueItem(newItem).subscribe({
          next: (res) => handler.handleQueueResult(newItem, true, res),
          error: (err) => handler.handleQueueResult(newItem, false, err)
        });
      }
      return newItem;
    }

    // Standard Labor-Verhalten: Aktion abfangen & als Entwurf ablegen
    const title = payload.displayInfo?.title || `Labor: ${action}`;

    const laborChain = this.createDraftChainInstance(
      title,
      [{ queueItem: newItem, isRootCause: false }],
      'LABOR',
      'Labor-Modus Simulation'
    );

    console.log(`🧪 [Labor-Modus] Aktion abgefangen & Entwurf erzeugt: ${action}`, laborChain);
    this.emitDraftChain(laborChain);

    return newItem;
  }

  /**
   * 🧪 Führt beim Labor-Bootstrap einen synchronen Single-Try-Durchlauf aus,
   * um die Sandbox mit frischen Serverdaten zu befüllen.
   */
  public fetchInitialDataForLabor(userId: string): Observable<boolean> {
    console.log(`🧪 [LaborQueueFetch] Starte Labor-Initial-Fetch für User-ID: "${userId}" (${this.registry.size} Handler)...`);

    if (!userId) {
      console.warn('⚠️ [LaborQueueFetch] Keine User-ID vorhanden.');
      return of(true);
    }

    const handlers: IQueueHandler[] = Array.from(this.registry.values());

    return from(handlers).pipe(
      concatMap((handler: IQueueHandler): Observable<boolean> => {
        console.log(`🔄 [LaborQueueFetch] 1 Versuch für Handler: ${handler.serviceName}`);
        return handler.refreshDataIfStale(userId).pipe(
          catchError((err: unknown): Observable<boolean> => {
            console.warn(`⚠️ [LaborQueueFetch] Handler ${handler.serviceName} fehlgeschlagen, weiter gehts:`, err);
            return of(false);
          })
        );
      }),
      finalize(() => {
        console.log('🏁 [LaborQueueFetch] Labor-Initial-Fetch abgeschlossen!');
      })
    );
  }
  
  /**
   * ➕ Neuen Labor-Entwurf hinzufügen
   */
  public addLaborChain(chain: DraftChain): void {
    this.activeChains.update(chains => [...chains, chain]);
    this.persistLaborData();
  }

 /**
   * 📦 Delegation / Paketierung einer Labor-Kette
   */
  public delegateChain(
    chainId: string, 
    target: DelegationTarget, 
    note?: string
  ): void {
    const chain = this.activeChains().find(c => c.id === chainId);
    if (!chain) return;

    const delegatedChain = chain.cloneWith({
      target,
      note,
      delegatedByUserId: this.authContext.getCurrentUserId() || ''
    });

    this.stagedDelegations.update(list => [...list, delegatedChain]);
    this.discardChain(chainId); // Entfernt aus active & führt Rollback durch
  }

  /**
   * 🗑️ Verwerfen einer Kette inkl. selektivem Rollback
   */
public discardChain(chainId: string): void {
    const chainToDiscard = this.activeChains().find(c => c.id === chainId);
    if (!chainToDiscard) return;

    this.registry.forEach(handler => handler.enableShadowMode(true));
    
    for (let i = chainToDiscard.items.length - 1; i >= 0; i--) {
      const item = chainToDiscard.items[i].queueItem;
      const handler = this.registry.get(item.serviceName);
      if (handler) {
        handler.rollbackItem(item);
      }
    }
    
    this.registry.forEach(handler => handler.enableShadowMode(false));

    this.activeChains.update(chains => chains.filter(c => c.id !== chainId));
    this.persistLaborData();
  }

  /**
   * 🧹 Bereinigt alle Labor-Daten nach dem Exit-Dialog
   */
  public clearLaborStorage(): void {
    this.activeChains.set([]);
    this.stagedDelegations.set([]);
    this.localStorageService.removeItem(this.LABOR_ACTIVE_KEY);
    this.localStorageService.removeItem(this.LABOR_STAGED_KEY);
  }

  public flushToLiveStorage(items: QueueItem[]): void {
    // 1. Items synchron in den Live-LocalStorage schreiben
    this.appendItemsToLiveQueueStorage(items);
    // 2. Eigenen Labor-Speicher leeren
    this.clearLaborStorage();
  }

  public override async processQueue(): Promise<void> {
    // Im Labor-Modus erfolgt keine Server-Abarbeitung
  }

  public override resetData(): void {
    
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}