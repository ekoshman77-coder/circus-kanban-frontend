import { Observable } from 'rxjs';
import { QueueItem } from '../../models/queue-items/queue-item';

export interface IQueueHandler {
  serviceName: string;

  /** Stößt den eigentlichen API-Call im DataManager an */
  executeQueueItem(item: QueueItem): Observable<any>;

  /** Verarbeitet das Ergebnis (Erfolg -> Temp-ID tauschen / 4xx -> Rollback) */
  handleQueueResult(item: QueueItem, success: boolean, response: any): void;

  checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void 
}