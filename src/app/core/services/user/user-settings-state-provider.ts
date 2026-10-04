import { SingleStateProvider } from '../central-queue/state-providers/single-state-provider';
import { UserSettings } from '../../models/user.settings';

export class UserSettingsStateProvider extends SingleStateProvider<UserSettings> {
  protected override storageKey = 'user_planner_settings_cache';

  // 🎯 Statische Modell-Referenz für generisches Deserialisieren & Cache-Laden
  protected modelStatic = UserSettings;

  constructor() {
    super(null);
  }

  // 🚀 FORWARD REPLAY (Optimistic Update)
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
}