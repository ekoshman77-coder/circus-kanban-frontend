import { effect, inject, Injectable } from '@angular/core';
import { from, of } from 'rxjs';
import { concatMap, finalize } from 'rxjs/operators';
import { ConnectionService } from '../connection/connection-service';
import { IQueueHandler } from './queue-handler-interface';
import { generateLocalId } from '../../shared/constants/id-const';
import { UserService } from '../user/user-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { BaseQueueDataManager } from './base-queue-data-manager';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { AUTH_CONTEXT } from '../user/auth-context';
import { Identifiable } from '../../models/identifable';
import { MockDraftService } from '../draft-chains/draft-service';

@Injectable({
  providedIn: 'root'
})
export class CentralQueueService extends BaseDataManager {
  private connectionService = inject(ConnectionService);
  private draftService = inject(MockDraftService)

  private authContext = inject(AUTH_CONTEXT);

  private readonly QUEUE_KEY = 'global_central_offline_queue';
  private registry = new Map<string, IQueueHandler>();
  private isProcessing = false;
  private isFetchingData = false;

  private queue: QueueItem[] = [];

  constructor() {
    super();
    this.queue = this.localStorageService.getItem(this.QUEUE_KEY) || [];

    effect(() => {
      if (this.connectionService.isOnline() && this.authContext.isLoggedIn()) {
        this.processQueue();
      }
    });
  }

  public registerService(name: string, handler: IQueueHandler): void {
    if (!this.registry.has(name)) {
      this.registry.set(name, handler);
      console.log(`🔌 [CentralQueueService] Handler erfolgreich registriert: "${name}"`);
    }
  }

  public enqueue(serviceName: string, action: string, payload: SnapshotPayload): QueueItem {
    const newItem: QueueItem = {
      id: generateLocalId(),
      serviceName,
      action,
      payload,
      timestamp: Date.now()
    };

    this.queue.push(newItem as QueueItem);
    this.persistQueue();

    if (this.connectionService.isOnline() && this.authContext.isLoggedIn()) {
      this.processQueue();
    }

    return newItem;
  }

  public setFetchingState(isFetching: boolean): void {
    this.isFetchingData = isFetching;
  }

  public isFetching(): boolean {
    return this.isFetchingData;
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing || this.isFetchingData || this.connectionService.isOffline() || !this.authContext.isLoggedIn()) {
      return;
    }

    // 🟢 Queue ist komplett verarbeitet -> Starte synchronen Refresh-Iterator
    if (this.queue.length === 0) {
      this.triggerSequentialRefresh();
      return;
    }

    this.isProcessing = true;
    const currentItem = this.queue[0];
    const targetService = this.registry.get(currentItem.serviceName);

    if (!targetService) {
      console.error(`❌ [CentralQueueService] Kein Handler für "${currentItem.serviceName}"! Item wird verworfen.`);
      this.dequeue();
      this.isProcessing = false;
      this.processQueue();
      return;
    }

    targetService.executeQueueItem(currentItem).subscribe({
      next: (response: any) => {
        targetService.handleQueueResult(currentItem, true, response);
        this.dequeue();
        this.isProcessing = false;
        this.processQueue();
      },
      error: (err: any) => {
        if (err.status >= 400 && err.status < 500) {
           this.handle4xxError(currentItem, targetService, err)
        } else {
          console.warn(`📡 [CentralQueueService] Netz/Serverfehler bei ${currentItem.action}. Pausiere Queue.`);
          this.isProcessing = false;
        }
      }
    });
  }

  private handle4xxError(
    currentItem: QueueItem,
    targetHandler: IQueueHandler,
    err: any
  ): void {
    console.warn(`🛑 [CentralQueueService] 4xx Fehler bei ${currentItem.action}. Starte Backward-Rollback & Forward-Replay.`);

    // 1. Shadow Mode GLOBAL auf allen registrierten Handlern aktivieren
    this.registry.forEach((handler, key) => handler.enableShadowMode(true));

    // 2. BACKWARD-ROLLBACK: Von hinten nach vorne die ganze Queue zurückspulen
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];
      const handler = this.registry.get(item.serviceName);
      if (handler) {
        handler.rollbackItem(item);
      }
    }

    // 3. LAWINEN-EXTRAKTION: Defekte Kette isolieren & aus Queue entfernen
    const dependentChain = this.extractDependentChain();

    // 4. In der Draft-Box sichern
    if (dependentChain.length > 0) {
      const errorMessage = err.error?.message || err.message || '4xx Fehler';
      this.draftService.saveDraftChain(dependentChain, errorMessage);
    }

    // 5. FORWARD-REPLAY: Von vorne nach hinten nur die verbliebenen, unbetroffenen Items anwenden
    for (const item of this.queue) {
      const handler = this.registry.get(item.serviceName);
      if (handler) {
        handler.applyRollForward(item);
      }
    }

    // 6. Shadow Mode GLOBAL deaktivieren -> BÄM! Sauberer UI-State
    this.registry.forEach((handler, key) => handler.enableShadowMode(false));

    // 7. Processing freigeben & Queue fortführen
    this.isProcessing = false;
    setTimeout(() => this.processQueue(), 0);
  }

  /**
   * 🔄 Sequentieller Refresh Iterator:
   * Geht fair einen DataManager nach dem anderen durch, sobald die Queue leer ist.
   */
  private triggerSequentialRefresh(): void {
    const userId = this.authContext.getCurrentUserId();
    if (!userId || this.connectionService.isOffline()) return;

    const handlers = Array.from(this.registry.values());

    // 🔒 1. Fetched-Status auf TRUE setzen
    this.isFetchingData = true;

    from(handlers).pipe(
      concatMap(handler => {
        if (handler instanceof BaseQueueDataManager) {
          return handler.refreshDataIfStale(userId);
        }
        return of(true);
      }),
      finalize(() => {
        // 🔓 2. Fetched-Status auf FALSE setzen & wartende Queue sofort aufwecken!
        this.isFetchingData = false;

        if (this.queue.length > 0) {
          this.processQueue();
        }
      })
    ).subscribe({
      complete: () => console.log('✅ [CentralQueueService] Sequentieller Daten-Refresh abgeschlossen.')
    });
  }

  /** Prüft, ob für einen spezifischen Service noch unverarbeitete Queue-Items vorliegen */
  public hasPendingItems(): boolean {
    return this.queue.length > 0;
  }

  private dequeue(): void {
    this.queue.shift();
    this.persistQueue();
  }

  public updateEntityIdInQueue(localId: string, serverId: string): void {
    this.queue.forEach(item => {
      if (item.payload && item.payload.id === localId) {
        item.payload.id = serverId;
      }
      const handler = this.registry.get(item.serviceName);
      handler!.checkAndReplaceIds(item, localId, serverId)
    });
    this.persistQueue();
  }

  public removeItemsForEntity(localId: string): void {
    this.queue = this.queue.filter(item => item.payload?.id !== localId);
    this.persistQueue();
  }

  public getQueue(): QueueItem[] {
    return [...this.queue];
  }

  private persistQueue(): void {
    this.localStorageService.setItem(this.QUEUE_KEY, this.queue);
  }

  public extractDependentChain(): QueueItem[] {
    const chainIds = new Set<string>();
    const connectedItems: QueueItem[] = [];
    const remainingQueue: QueueItem[] = [];

    // Wenn die Queue leer ist, direkt raus
    if (this.queue.length === 0) {
      return [];
    }

    // Start-ID des fehlgeschlagenen Items direkt in die Lawine werfen
    chainIds.add(this.queue[0].payload.id);

    // Der Loop wandert durch die gesamte Queue
    for (const item of this.queue) {
      const handler = this.registry.get(item.serviceName);
      if (!handler) {
        throw new Error(`💥 Kein Handler gefunden für: ${item.serviceName}`);
      }

      // Da das erste Item seine ID schon in chainIds hat, matcht es hier sofort!
      const isConnected = handler.dependsOnId(item, chainIds);

      if (isConnected) {
        connectedItems.push(item);
        // Neue IDs des erkannten Items einsammeln
        handler.extractEntityIds(item).forEach(id => chainIds.add(id));
      } else {
        remainingQueue.push(item);
      }
    }

    // Queue aktualisieren und speichern
    this.queue = remainingQueue;
    this.persistQueue();

    return connectedItems;
  }

  public override resetData(): void {
    this.queue = [];
    this.localStorageService.removeItem(this.QUEUE_KEY);
    this.isProcessing = false;
  }

  public override checkUnsavedData(): string | null {
    if (this.queue.length > 0) {
      return "Einige Anfragen sind noch nicht zum Server geschickt worden.";
    }
    return super.checkUnsavedData();
  }
}