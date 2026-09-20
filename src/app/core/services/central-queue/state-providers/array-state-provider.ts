import { Identifiable } from "../../../models/identifable";
import { StateProvider } from './base-state-provider';

export abstract class ArrayStateProvider<TItem extends Identifiable> extends StateProvider<TItem[]> {
  constructor(initialItems: TItem[] = []) {
    super(initialItems);
  }

  /** Unmutierende Array-Hilfsmethode */
  protected applyAction(actionFn: (current: TItem[]) => TItem[]): void {
    const current = this.getState();
    const updated = actionFn(current);
    this.setRawState(updated);
  }

  // 🆔 Automatische ID-Ersetzung in der Liste
  public override replaceId(localId: string, serverId: string): void {
    this.applyAction((items) =>
      items.map((item) => {
        if (item.id === localId) {
          return { ...item, id: serverId };
        }
        return item;
      })
    );
  }

  // ➕ Item hinzufügen oder aktualisieren
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

  // ➖ Item per ID löschen
  protected removeItemById(id: string): void {
    this.applyAction((items) => items.filter((item) => item.id !== id));
  }

  // 📸 Snapshots für Arrays (Garantiert reine JSON-Objekte)
  public override createSnapshot(): any[] {
    return this.getState().map((item) => {
      return typeof (item as any).toJson === 'function' 
        ? (item as any).toJson() 
        : { ...item };
    });
  }
}