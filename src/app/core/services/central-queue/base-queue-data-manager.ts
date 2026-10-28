import { inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { QueueItem } from '../../models/queue-items/queue-item';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { IQueueHandler } from './queue-handler-interface';
import { CentralQueueService } from './central-queue-service';
import { NotificationService } from '../notification/notification-service';
import { StateProvider } from './state-providers/base-state-provider';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { LoggerService } from '../logger/logger-service';

export abstract class BaseQueueDataManager<TProvider extends StateProvider<any> = StateProvider<any> >
                     extends BaseDataManager implements IQueueHandler {
  protected queueService = inject(CentralQueueService);
  protected notificationService = inject(NotificationService);
  protected logger = inject(LoggerService);

  serviceName: QueueHandlerName;
  protected stateProvider: TProvider;

  private lastFetchTimestamp = 0;
  private readonly FETCH_COOLDOWN_MS = 30000;

  constructor(name: QueueHandlerName) {
    super();
    this.serviceName = name;
    this.stateProvider = this.createStateProvider();
    this.stateProvider.loadFromCache()
    this.queueService.registerService(name, this);
  }

  protected abstract createStateProvider(): TProvider;

  public abstract executeQueueItem(item: QueueItem): Observable<any>;
  protected abstract fetchFromServer(userId: string): Observable<void>;

  /** Lädt beim Start einmalig den Cache über den Provider */
  public loadInitialCache(): void {
    this.stateProvider.loadFromCache();
  }

  /** Erzwungener Fetch ohne Cooldown-Prüfung */
  public forceFetchFromServer(userId: string = ''): Observable<void> {
    return this.fetchFromServer(userId).pipe(
      tap(() => {
        this.lastFetchTimestamp = Date.now();
      })
    );
  }

  public refreshDataIfStale(userId: string): Observable<boolean> {
    const now = Date.now();
    const diff = now - this.lastFetchTimestamp;

    if (diff < this.FETCH_COOLDOWN_MS) {
      this.logger.info(
        this.serviceName, 
        `⏳ [Refresh] Übersprungen wegen Cooldown. Noch ${Math.round((this.FETCH_COOLDOWN_MS - diff) / 1000)}s übrig.`
      );
      return of(true);
    }

    this.logger.info(this.serviceName, `🔄 [Refresh] Starte regulären Fetch vom Server für User: ${userId}`);

    return this.fetchFromServer(userId).pipe(
      tap(() => {
        if (this.queueService.hasPendingItems()) {
          this.logger.warn(this.serviceName, `⚠️ Server-Antwort verworfen, da ungesendete Offline-Items vorliegen.`);
          return;
        }
        this.lastFetchTimestamp = Date.now();
        this.logger.info(this.serviceName, `✅ [Refresh] Erfolgreich abgeschlossen.`);
      }),
      map(() => true),
      catchError((err) => {
        this.logger.error(this.serviceName, `❌ Fehler beim Aktualisieren der Daten:`, err);
        return of(false);
      })
    );
  }

  // ==========================================
  // RESULT HANDLING (Aufgeteilt in Erfolgs- und Fehlerpfad)
  // ==========================================

  public handleQueueResult(item: QueueItem, success: boolean, response: any): void {
    if (success) {
      this.handleSuccessResult(item, response);
    } else {
      this.handleErrorResult(item, response);
    }
  }

  protected handleSuccessResult(item: QueueItem, response: any): void {
    const payload = item.payload;
    if (item.action.startsWith('CREATE') && response) {
      const serverId = response.id || response;
      this.checkAndReplaceIds(item, payload.id, serverId);
      this.queueService.updateEntityIdInQueue(payload.id, serverId);
    }
  }

  protected handleErrorResult(item: QueueItem, error: any): void {
    const payload = item.payload;

    console.warn(`🛑 [${this.serviceName}] Fehler bei "${item.action}". Starte Rollback für Entity: ${payload?.id}`);
    this.notificationService.showNotification(
      'Änderung konnte nicht gespeichert werden. Der vorherige Zustand wurde wiederhergestellt.',
      'error'
    );

    this.rollbackItem(item);

    if (item.action.startsWith('CREATE') && payload?.id) {
      this.queueService.removeItemsForEntity(payload.id);
    }
  }

  // ==========================================
  // RECOVERY & SHADOW MODE (Delegation an StateProvider)
  // ==========================================

  public enableShadowMode(active: boolean): void {
    if (active) {
      this.stateProvider.enterShadowMode();
    } else {
      this.stateProvider.exitShadowMode();
    }
  }

  public rollbackItem(item: QueueItem): void {
    const snapshot = item.payload?.snapshot;

    if (snapshot) {
      this.stateProvider.restoreFromSnapshot(snapshot);
    } else {
      this.handleWithoutSnapshot(item);
    }
  }

  public applyRollForward(item: QueueItem): void {
    // Entkoppelt: Sendet nur Action und Payload an den Provider!
    this.stateProvider.applyActionPayload(item.action, item.payload);
  }

  protected handleWithoutSnapshot(item: QueueItem): void {}

  // ==========================================
  // ENTITY & ID HELPER
  // ==========================================

  public checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    this.stateProvider.replaceId(localId, serverId);
  }

  public extractEntityIds(item: QueueItem): string[] {
    return item.payload?.id ? [item.payload.id] : [];
  }

  public dependsOnId(item: QueueItem, targetIds: Set<string>): boolean {
    const itemIds = this.extractEntityIds(item);
    return itemIds.some(id => targetIds.has(id));
  }

  public getSignal() {
    return this.stateProvider.getSignal();
  }

  /** Setzt den lokalen Zustand & Cache über den StateProvider zurück (z.B. bei Logout) */
  public resetData(): void {
    this.lastFetchTimestamp = 0
    this.stateProvider.resetState();
  }
}