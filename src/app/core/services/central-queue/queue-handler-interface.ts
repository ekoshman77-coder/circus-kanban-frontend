import { Observable } from 'rxjs';
import { QueueItem } from '../../models/queue-items/queue-item';

export interface IQueueHandler {
  serviceName: string;

  /** Stößt den eigentlichen API-Call im DataManager an */
  executeQueueItem(item: QueueItem): Observable<any>;

  /** Verarbeitet das Ergebnis eines Queue-Items (Success / Error) */
  handleQueueResult(item: QueueItem, success: boolean, response: any): void;

  /** Tauscht Temp-IDs im Queue-Item und im StateProvider aus */
  checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void;

  /** Extrahiert alle relevanten Entity-IDs, die dieses Item berührt oder mitbringt */
  extractEntityIds(item: QueueItem): string[];
  
  /** Prüft, ob ein Queue-Item von bestimmten IDs abhängt */
  dependsOnId(item: QueueItem, targetIds: Set<string>): boolean;

  /** Erzwungenes Neuladen der Daten vom Server */
  forceFetchFromServer(userId?: string): Observable<void>;

  // 🎯 RECOVERY & SHADOW MODE WERKZEUGE
  /** Steuert den Schatten-Modus des StateProviders (true = an, false = aus) */
  enableShadowMode(active: boolean): void;

  /** Stellt den Zustand aus dem Snapshot des Items wieder her (Rollback) */
  rollbackItem(item: QueueItem): void;

  /** Wendet eine Aktion im Shadow Mode erneut an (Forward Replay) */
  applyRollForward(item: QueueItem): void;
}