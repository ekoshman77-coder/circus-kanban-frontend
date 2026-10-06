import { inject, Injectable, signal } from '@angular/core';
import { Observable, merge } from 'rxjs';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { IQueueHandler } from './queue-handler-interface';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { ICentralQueueService } from './central-queue-service-interface';
import { LiveCentralQueueService } from './live-central-queue-service';
import { LaborCentralQueueService } from './labor-central-queue-service';

@Injectable({
  providedIn: 'root'
})
export class CentralQueueService implements ICentralQueueService {
  private liveQueue = inject(LiveCentralQueueService);
  private laborQueue = inject(LaborCentralQueueService);

  public isLaborMode = signal<boolean>(false);

  // Kombiniert die Draft-Streams beider Services zu einem zentralen Stream
  public draftChainCreated$: Observable<DraftChain> = merge(
    this.liveQueue.draftChainCreated$,
    this.laborQueue.draftChainCreated$
  );

  private activeService(): ICentralQueueService {
    return this.isLaborMode() ? this.laborQueue : this.liveQueue;
  }

  public toggleLaborMode(): void {
    this.isLaborMode.update(val => !val);
    console.log(`🧪 Labor-Modus: ${this.isLaborMode() ? 'AKTIV 🟢' : 'INAKTIV 🔴'}`);
  }

  // ==========================================
  // DELEGATION ALLER INTERFACE-METHODEN
  // ==========================================

  public registerService(name: QueueHandlerName, handler: IQueueHandler): void {
    // Registriert den Handler in BEIDEN Services, damit der Switch jederzeit nahtlos klappt
    this.liveQueue.registerService(name, handler);
    this.laborQueue.registerService(name, handler);
  }

  public enqueue(serviceName: QueueHandlerName, action: string, payload: SnapshotPayload): QueueItem {
    return this.activeService().enqueue(serviceName, action, payload);
  }

  public processQueue(): Promise<void> {
    return this.activeService().processQueue();
  }

  public hasPendingItems(): boolean {
    return this.activeService().hasPendingItems();
  }

  public getQueue(): QueueItem[] {
    return this.activeService().getQueue();
  }

  public removeItemsForEntity(localId: string): void {
    this.activeService().removeItemsForEntity(localId);
  }

  public updateEntityIdInQueue(localId: string, serverId: string): void {
    this.activeService().updateEntityIdInQueue(localId, serverId);
  }

  public reinjectChain(items: QueueItem[]): void {
    this.activeService().reinjectChain(items);
  }

  public extractDependentChain(): QueueItem[] {
    return this.activeService().extractDependentChain();
  }

  isItemDependentOnChain(newItem: QueueItem, chainItems: DraftChainItem[]): boolean {
    throw new Error('Method not implemented.');
  }


  public setFetchingState(isFetching: boolean): void {
    this.activeService().setFetchingState(isFetching);
  }

  public isFetching(): boolean {
    return this.activeService().isFetching();
  }

  public resetData(): void {
    this.liveQueue.resetData();
    this.laborQueue.resetData();
  }

  public checkUnsavedData(): string | null {
    return this.activeService().checkUnsavedData();
  }
}