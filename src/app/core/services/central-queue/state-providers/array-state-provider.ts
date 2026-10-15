import { DomainModel, DomainModelStatic } from '../../../models/domain-model';
import { StateProvider } from './base-state-provider';

export abstract class ArrayStateProvider< TItem extends DomainModel< TItem > > extends StateProvider< TItem[] > {
  protected abstract modelStatic: DomainModelStatic< TItem >;

  constructor(initialItems: TItem[] = []) {
    super(initialItems);
  }

  protected applyAction(actionFn: (current: TItem[]) => TItem[]): void {
    const current = this.getState();
    const updated = actionFn(current);
    this.setRawState(updated);
  }

  public override replaceId(localId: string, serverId: string): void {
    this.applyAction((items) =>
      items.map((item) => {
        if (item.id === localId) {
          // 🛡️ BÄM: Verwende cloneWith statt { ...item }
          return item.cloneWith({ id: serverId } as Partial< TItem >);
        }
        return item;
      })
    );
  }

  protected addOrUpdateItem(newItem: TItem): void {
    this.applyAction((items) => {
      const index = items.findIndex((i) => i.id === newItem.id);
      if (index >= 0) {
        const copy = [...items];
        copy[index] = newItem;
        return copy;
      }
      return [...items, newItem];
    });
  }

  protected removeItemById(id: string): void {
    this.applyAction((items) => items.filter((item) => item.id !== id));
  }

  public override createSnapshot(): any[] {
    return this.getState().map((item) => item.toJson());
  }

  public override restoreFromSnapshot(snapshot: unknown): void {
    if (Array.isArray(snapshot)) {
      const restored = snapshot.map((json) => this.modelStatic.fromJson(json));
      this.setRawState(restored);
    }
  }

  // 📦 Universelle Cache-Lade-Methode für ALLE Array-Provider!
  public loadFromCache(): void {
    if (!this.storageKey) return;
    const cached = this.localStorageService.getItem< any[] >(this.storageKey);
    if (cached && Array.isArray(cached)) {
      this.restoreFromSnapshot(cached);
    }
  }
}