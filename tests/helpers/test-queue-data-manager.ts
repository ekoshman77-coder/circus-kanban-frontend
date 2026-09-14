import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { BaseQueueDataManager } from '../../src/app/core/services/central-queue/base-queue-data-manager';
import { QueueItem } from '../../src/app/core/models/queue-items/queue-item';

export class TestQueueDataManager extends BaseQueueDataManager {
  public resetData(): void {
      throw new Error('Method not implemented.');
  }
  readonly serviceName = 'TestService';

  public executeCall = vi.fn().mockReturnValue(of({ id: 'server-1' }));
  public fetchCall = vi.fn().mockReturnValue(of(undefined));
  public resetStateImpl = vi.fn();
  public onEntityCreatedImpl = vi.fn();
  public handleWithoutSnapshotImpl = vi.fn();

  executeQueueItem(item: QueueItem): Observable<void> {
    return this.executeCall(item);
  }

  resetState(snapshot: any): void {
    this.resetStateImpl(snapshot);
  }

  protected onEntityCreated(tempId: string, response: any): void {
    this.onEntityCreatedImpl(tempId, response);
  }

  protected handleWithoutSnapshot(item: QueueItem): void {
    this.handleWithoutSnapshotImpl(item);
  }

  protected fetchFromServer(userId: string): Observable<void> {
    return this.fetchCall(userId);
  }
}