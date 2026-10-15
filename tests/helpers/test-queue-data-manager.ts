import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { BaseQueueDataManager } from '../../src/app/core/services/central-queue/base-queue-data-manager';
import { QueueItem } from '../../src/app/core/models/queue-items/queue-item';
import { StateProvider } from '../../src/app/core/services/central-queue/state-providers/base-state-provider';
import { QueueHandlerName } from '../../src/app/core/enums/queue-handler-name';

// Mock-Klasse für StateProvider erzeugen
export class MockStateProvider extends StateProvider< any > {
  protected storageKey = 'test_storage_key';

  public override replaceId = vi.fn();
  public restoreFromSnapshot = vi.fn();
  public loadFromCache = vi.fn();
  public createSnapshot = vi.fn();
  public applyActionPayload = vi.fn();

  constructor() {
    super([]);
  }
}

export class TestQueueDataManager extends BaseQueueDataManager {
  public mockProvider = new MockStateProvider();

  constructor() {
    super(QueueHandlerName.DRAFT);
  }

  // 🟢 Statt throw Error geben wir einen Mock StateProvider zurück!
  protected override createStateProvider(): StateProvider< any > {
    this.mockProvider = new MockStateProvider();
    return this.mockProvider;
  }

  public override resetData(): void {
    this.mockProvider.resetState();
  }

  public executeCall = vi.fn().mockReturnValue(of({ id: 'server-1' }));
  public fetchCall = vi.fn().mockReturnValue(of(undefined));
  public resetStateImpl = vi.fn();
  public onEntityCreatedImpl = vi.fn();
  public handleWithoutSnapshotImpl = vi.fn();

  executeQueueItem(item: QueueItem): Observable< any > {
    return this.executeCall(item);
  }

  resetState(snapshot: any): void {
    this.resetStateImpl(snapshot);
  }

  protected onEntityCreated(tempId: string, response: any): void {
    this.onEntityCreatedImpl(tempId, response);
  }

  protected override handleWithoutSnapshot(item: QueueItem): void {
    this.handleWithoutSnapshotImpl(item);
  }

  protected fetchFromServer(userId: string): Observable< void > {
    return this.fetchCall(userId);
  }
}