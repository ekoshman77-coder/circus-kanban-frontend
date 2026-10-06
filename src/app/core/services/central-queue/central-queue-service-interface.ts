// src/app/core/services/central-queue/central-queue-service.interface.ts

import { Observable } from 'rxjs';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { IQueueHandler } from './queue-handler-interface';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';

export interface ICentralQueueService {
  /** 
   * Einziger Stream für alle neu entstehenden Entwürfe 
   * (Egal ob Live-Fehler oder Labor-Aktion)
   */
  draftChainCreated$: Observable<DraftChain>;

  registerService(name: QueueHandlerName, handler: IQueueHandler): void;
  enqueue(serviceName: QueueHandlerName, action: string, payload: SnapshotPayload): QueueItem;
  processQueue(): Promise<void>;
  hasPendingItems(): boolean;
  getQueue(): QueueItem[];
  removeItemsForEntity(localId: string): void;
  updateEntityIdInQueue(localId: string, serverId: string): void;
  reinjectChain(items: QueueItem[]): void;
  extractDependentChain(): QueueItem[];
  setFetchingState(isFetching: boolean): void;
  isFetching(): boolean;
  resetData(): void;
  checkUnsavedData(): string | null;
  isItemDependentOnChain(newItem: QueueItem, chainItems: DraftChainItem[]): boolean;
}