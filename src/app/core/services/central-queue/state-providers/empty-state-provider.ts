import { StateProvider } from './base-state-provider';

export class EmptyStateProvider extends StateProvider<null> {
  protected override storageKey = '';

  constructor() {
    super(null);
  }

  public override applyActionPayload(action: string, payload: any): void {}
  public override createSnapshot(): null { return null; }
  public override restoreFromSnapshot(snapshot: unknown): void {}
  public override loadFromCache(): void {}
  protected override saveToCache(): void {}
}