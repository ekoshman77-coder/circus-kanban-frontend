import { Injectable, inject, signal, effect } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { UserRepository, PlannerSettingsDto } from '../../repositories/user-repository';
import { LocalStorageService } from './local-storage-service';
import { AUTH_CONTEXT } from './auth-context';
import { UserSettingsPayload } from '../../models/queue-items/user-settings-payload';

export type UserEnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsDataManager extends BaseQueueDataManager {

  private userRepository = inject(UserRepository);
  private authContext = inject(AUTH_CONTEXT);

  // 🎯 Die Fachdaten-Signals
  public primeTimeStartHour = signal< number >(10);
  public primeTimeEndHour = signal< number >(18);
  public workingHours = signal< number >(8);
  public workingTimeLeft = signal< number >(8);
  
  // ⚡ Tagesform / Energie (Lokal im Storage)
  public userEnergy = signal< UserEnergyLevel >('MEDIUM');

  constructor() {
    super('UserSettingsDataManager');

    const savedTimeLeft = this.localStorageService.getItem< number >(LocalStorageService.KEYS.WORKING_TIME_LEFT);
    if (savedTimeLeft !== null) {
      this.workingTimeLeft.set(savedTimeLeft);
    }

    const savedEnergy = this.localStorageService.getItem< UserEnergyLevel >(LocalStorageService.KEYS.USER_ENERGY);
    if (savedEnergy) {
      this.userEnergy.set(savedEnergy);
    }
  }

  // ------------------------------------------------------------------
  // Public Business Methods
  // ------------------------------------------------------------------

  public setUserEnergy(energy: UserEnergyLevel): void {
    this.userEnergy.set(energy);
    this.localStorageService.setItem(LocalStorageService.KEYS.USER_ENERGY, energy);
  }

  public changeWorkingTimeLeft(hours: number): void {
    this.workingTimeLeft.set(hours);
    this.localStorageService.setItem(LocalStorageService.KEYS.WORKING_TIME_LEFT, hours);
  }

  public changePrimeTimeStart(hour: number): void {
    this.primeTimeStartHour.set(hour);
    this.persistSettingsToBackend();
  }

  public changePrimeTimeEnd(hour: number): void {
    this.primeTimeEndHour.set(hour);
    this.persistSettingsToBackend();
  }

  public changeDefaultWorkingHours(hours: number): void {
    this.workingHours.set(hours);
    this.persistSettingsToBackend();
  }

  // ------------------------------------------------------------------
  // Queue & Persistence Logic
  // ------------------------------------------------------------------

  private persistSettingsToBackend(): void {
    const userId = this.authContext.getCurrentUserId();
    if (!userId) return;

    const settings: PlannerSettingsDto = {
      userId,
      defaultWorkingHours: this.workingHours(),
      primeTimeStartHour: this.primeTimeStartHour(),
      primeTimeEndHour: this.primeTimeEndHour()
    };

    const payload: UserSettingsPayload = {
      id: userId,
      userId,
      settings
    };

    this.queueService.enqueue(this.serviceName, 'UPDATE_SETTINGS', payload);
  }

  // ------------------------------------------------------------------
  // Framework Implementation (BaseQueueDataManager)
  // ------------------------------------------------------------------

  public executeQueueItem(item: QueueItem): Observable< any > {
    if (item.action === 'UPDATE_SETTINGS') {
      const payload = item.payload as UserSettingsPayload;
      const userId = payload?.userId || this.authContext.getCurrentUserId();

      if (!userId) {
        console.error('🛑 [UserSettingsDataManager] Keine validierte UserId für Update vorhanden.');
        return of(false);
      }

      return this.userRepository.updateSettings(userId, payload.settings);
    }
    return of(true);
  }

  public override resetState(snapshot: any): void {
    if (snapshot) {
      if (snapshot.primeTimeStartHour !== undefined) this.primeTimeStartHour.set(snapshot.primeTimeStartHour);
      if (snapshot.primeTimeEndHour !== undefined) this.primeTimeEndHour.set(snapshot.primeTimeEndHour);
      if (snapshot.defaultWorkingHours !== undefined) this.workingHours.set(snapshot.defaultWorkingHours);
    }
  }

  protected override onEntityCreated(tempId: string, response: any): void {
    // Settings erzeugen keine neuen Entitäten
  }

  protected override fetchFromServer(userId: string): Observable< void > {
    return this.userRepository.getSettings(userId).pipe(
      tap((settings) => {
        this.primeTimeStartHour.set(settings.primeTimeStartHour);
        this.primeTimeEndHour.set(settings.primeTimeEndHour);
        this.workingHours.set(settings.defaultWorkingHours);

        if (this.localStorageService.getItem(LocalStorageService.KEYS.WORKING_TIME_LEFT) === null) {
          this.workingTimeLeft.set(settings.defaultWorkingHours);
        }
      }),
      map(() => void 0)
    );
  }

  public override resetData(): void {
    this.primeTimeStartHour.set(10);
    this.primeTimeEndHour.set(18);
    this.workingHours.set(8);
    this.workingTimeLeft.set(8);
    this.userEnergy.set('MEDIUM');
  }
}