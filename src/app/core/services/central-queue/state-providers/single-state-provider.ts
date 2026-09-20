import { StateProvider } from './base-state-provider';

export abstract class SingleStateProvider<T> extends StateProvider<T | null> {
  constructor(initialItem: T | null = null) {
    super(initialItem);
  }

  /** Zuweisen eines neuen Einzel-Objekts oder null */
  public setState(newItem: T | null): void {
    this.setRawState(newItem);
  }

  /** Aktualisiert das bestehende Objekt partiell (Partial Update) */
  public updateState(partial: Partial<T>): void {
    const current = this.getState();
    if (current && typeof current === 'object') {
      this.setRawState({ ...current, ...partial });
    }
  }

  // 📸 Snapshots für Einzel-Objekte (Garantierte JSON-Serialisierung)
  public override createSnapshot(): any {
    const state = this.getState();
    if (!state) return null;

    return typeof (state as any).toJson === 'function'
      ? (state as any).toJson()
      : JSON.parse(JSON.stringify(state));
  }
}