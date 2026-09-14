import { inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map, catchError, finalize } from 'rxjs/operators';
import { QueueItem } from '../../models/queue-items/queue-item';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { IQueueHandler } from './queue-handler-interface';
import { CentralQueueService } from './central-queue-service';
import { NotificationService } from '../notification/notification-service';

export abstract class BaseQueueDataManager extends BaseDataManager implements IQueueHandler {
  protected queueService = inject(CentralQueueService);
  protected notificationService = inject(NotificationService);

  serviceName: string;

  private lastFetchTimestamp = 0;
  private readonly FETCH_COOLDOWN_MS = 30000; // 30 Sekunden Schutzfenster

  constructor(name: string) {
    super();
    this.serviceName = name;
    this.queueService.registerService(name, this);
  }

  public abstract executeQueueItem(item: QueueItem): Observable<any>;
  public abstract resetState(snapshot: any): void;
  protected abstract onEntityCreated(tempId: string, response: any): void;

  /** Von konkreten DataManagern zu implementieren: Holt frische Daten vom Server & speichert sie im Signal/Cache */
  protected abstract fetchFromServer(userId: string): Observable<void>;

  /**
   * 🔄 Sequentielles Rehydration-Pattern mit Race-Condition-Protection
   */
  public refreshDataIfStale(userId: string): Observable<boolean> {
    const now = Date.now();

    if (now - this.lastFetchTimestamp < this.FETCH_COOLDOWN_MS) {
      return of(true);
    }

    return this.fetchFromServer(userId).pipe(
      tap(() => {
        // 🛡️ GUARD: Wenn die Queue nicht leer ist, verwerfen
        if (this.queueService.hasPendingItems()) {
          console.warn(`⚠️ [${this.serviceName}] Server-Antwort verworfen, da ungesendete Offline-Items vorliegen.`);
          return of(false);
        }

        this.lastFetchTimestamp = Date.now();
        return of(true)
      }),
      map(() => true),
      catchError((err) => {
        console.error(`❌ [${this.serviceName}] Fehler beim Aktualisieren der Daten:`, err);
        return of(false);
      })
    );
  }
  /**
   * 🎯 Zentrale Template-Methode für Queue-Ergebnisse
   */
  public handleQueueResult(item: QueueItem, success: boolean, response: any): void {
    const payload = item.payload;

    if (success) {
      if (item.action.startsWith('CREATE') && response) {
        this.onEntityCreated(payload.id, response);
        this.queueService.updateEntityIdInQueue(payload.id, response.id || response);
      }
      return;
    }

    // 🛑 FEHLERFALL (4xx): Rollback durchführen!
    console.warn(`🛑 [${this.serviceName}] Fehler bei "${item.action}". Starte Rollback für Entity: ${payload.id}`);
    this.notificationService.showNotification(
      'Änderung konnte nicht gespeichert werden. Der vorherige Zustand wurde wiederhergestellt.',
      'error'
    );

    if (payload?.snapshot) {
      this.resetState(payload.snapshot);
    } else {
      this.handleWithoutSnapshot(item);
    }

    if (item.action.startsWith('CREATE')) {
      this.queueService.removeItemsForEntity(payload.id);
    }
  }

  protected handleWithoutSnapshot(item: QueueItem): void {
    // Standardmäßig leer, da Payloads Snapshots mitbringen. 
    // Kann bei Bedarf in konkreten Klassen überschrieben werden.
  }

  public checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    // Standardmäßig tut sie nichts. Nur Manager, die Relationen haben, überschreiben sie.
  }
}