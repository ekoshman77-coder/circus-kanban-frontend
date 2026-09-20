import { SingleStateProvider } from '../central-queue/state-providers/single-state-provider';
import { UserSettings } from '../../models/user.settings';

export class UserSettingsStateProvider extends SingleStateProvider<UserSettings> {
  protected storageKey = 'user_planner_settings_cache';

  constructor() {
    super(null);
  }

  // 1. CACHE LADEN
  public override loadFromCache(): void {
    const raw = this.localStorageService.getItem<any>(this.storageKey);
    if (raw) {
      this.setRawState(UserSettings.fromJson(raw));
    }
  }

  // 2. FORWARD REPLAY (Optimistic Update)
  public override applyActionPayload(action: string, payload: any): void {
    if (action === 'SET_SETTINGS' && payload?.settings) {
      const newSettings = payload.settings instanceof UserSettings
        ? payload.settings
        : UserSettings.fromJson(payload.settings);
        
      this.setRawState(newSettings);
      return;
    }

    if (action === 'UPDATE_SETTINGS' && payload?.changes) {
      const current = this.getState() || new UserSettings(payload.userId || '');
      const updated = current.cloneWith(payload.changes);
      this.setRawState(updated);
    }
  }

  // 3. SNAPSHOTS (Verwendet automatisch toJson)
  public override createSnapshot(): any {
    const current = this.getState();
    return current ? current.toJson() : null;
  }

  public override restoreFromSnapshot(snapshot: unknown): void {
    if (snapshot) {
      this.setRawState(UserSettings.fromJson(snapshot));
    } else {
      this.setRawState(null);
    }
  }
}