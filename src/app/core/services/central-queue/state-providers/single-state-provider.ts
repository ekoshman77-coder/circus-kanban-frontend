import { DomainModel, DomainModelStatic } from '../../../models/domain-model';
import { StateProvider } from './base-state-provider';

export abstract class SingleStateProvider< T extends DomainModel< T > > extends StateProvider< T | null > {
  protected abstract modelStatic: DomainModelStatic< T >;

  constructor(initialItem: T | null = null) {
    super(initialItem);
  }

  // 📦 Universelles Laden aus dem Cache für JEDEN SingleStateProvider!
  public loadFromCache(): void {
    if (!this.storageKey) return;
    const cached = this.localStorageService.getItem< any >(this.storageKey);
    if (cached) {
      this.restoreFromSnapshot(cached);
    }
  }

  public setState(newItem: T | null): void {
    this.setRawState(newItem);
  }

  public updateState(partial: Partial< T >): void {
    const current = this.getState();
    if (current) {
      const updated = current.cloneWith(partial);
      this.setRawState(updated);
    }
  }

  public override createSnapshot(): any {
    const state = this.getState();
    return state ? state.toJson() : null;
  }

  public override restoreFromSnapshot(snapshot: unknown): void {
    if (snapshot && typeof snapshot === 'object') {
      const restored = this.modelStatic.fromJson(snapshot);
      this.setRawState(restored);
    } else {
      this.setRawState(null);
    }
  }
}