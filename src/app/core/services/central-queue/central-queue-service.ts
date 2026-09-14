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

@Injectable({
  providedIn: 'root'
})
export class CentralQueueService extends BaseDataManager {
  private connectionService = inject(ConnectionService);
  private authContext = inject(AUTH_CONTEXT);

  private readonly QUEUE_KEY = 'global_central_offline_queue';
  private registry = new Map();
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
          console.warn(`🛑 [CentralQueueService] 4xx Fehler bei ${currentItem.action}. Storniere Item.`);
          targetService.handleQueueResult(currentItem, false, err);
          this.dequeue();
          this.isProcessing = false;
          this.processQueue();
        } else {
          console.warn(`📡 [CentralQueueService] Netz/Serverfehler bei ${currentItem.action}. Pausiere Queue.`);
          this.isProcessing = false;
        }
      }
    });
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
      const handler = this.registry.get(item.serviceName) as BaseQueueDataManager;
      handler.checkAndReplaceIds(item, localId, serverId)
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