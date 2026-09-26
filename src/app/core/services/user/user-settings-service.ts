import { Injectable, inject, computed, Signal } from '@angular/core';
import { UserSettingsDataManager } from './user-settings-data-manager';
import { UserEnergyLevel, UserSettings } from '../../models/user.settings';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private dataManager = inject(UserSettingsDataManager);

  // 1. Schreibgeschützte UI-Signals für die Komponenten
  public readonly settings: Signal<UserSettings | null> = this.dataManager.settings;

  public readonly userEnergy = computed<UserEnergyLevel>(
    () => this.settings()?.userEnergy ?? 'MEDIUM'
  );

  public readonly workingTimeLeft = computed<number>(
    () => this.settings()?.workingTimeLeft ?? 8
  );

  public readonly workingHours = computed<number>(
    () => this.settings()?.defaultWorkingHours ?? 8
  );

  public readonly primeTimeStartHour = computed<number>(
    () => this.settings()?.primeTimeStartHour ?? 10
  );

  public readonly primeTimeEndHour = computed<number>(
    () => this.settings()?.primeTimeEndHour ?? 18
  );

  // 2. UI-Aktionen (Commands), die an den DataManager weitergereicht werden
  public setUserEnergy(energy: UserEnergyLevel): void {
    this.dataManager.updateSettings({ userEnergy: energy });
  }

  public setWorkingTimeLeft(hours: number): void {
    this.dataManager.updateSettings({ workingTimeLeft: hours });
  }

  public changeDefaultWorkingHours(hours: number): void {
    this.dataManager.updateSettings({ defaultWorkingHours: hours });
  }

  public changePrimeTimeStart(hour: number): void {
    this.dataManager.updateSettings({ primeTimeStartHour: hour });
  }

  public changePrimeTimeEnd(hour: number): void {
    this.dataManager.updateSettings({ primeTimeEndHour: hour });
  }
}