import { Injectable, inject, computed, Signal } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { AUTH_CONTEXT } from './auth-context';
import { UserSettingsStateProvider } from './user-settings-state-provider';
import { StateProvider } from '../central-queue/state-providers/base-state-provider';
import { UserRepository } from '../../repositories/user-repository';
import { UserEnergyLevel, UserSettings } from '../../models/user.settings';
import { PlannerSettingsDto } from '../../repositories/dto/planner-settings-dto';
import { UserSettingsPayload } from '../../models/queue-items/user-settings-payload';
import { QueueHandlerName } from '../../enums/queue-handler-name';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsDataManager extends BaseQueueDataManager {
  private userRepository = inject(UserRepository);
  private authContext = inject(AUTH_CONTEXT);

  constructor() {
    super(QueueHandlerName.USER_SETTINGS);
    this.loadInitialCache();
  }

  protected override createStateProvider(): StateProvider<UserSettings | null> {
    return new UserSettingsStateProvider();
  }

  // ==========================================
  // SIGNALS & GETTER FÜR DIE UI
  // ==========================================

  public get settings(): Signal<UserSettings | null> {
    return this.getSignal() as Signal<UserSettings | null>;
  }

  public userEnergy: Signal<UserEnergyLevel> = computed(() => {
    return this.settings()?.userEnergy ?? 'MEDIUM';
  });

  public workingTimeLeft: Signal<number> = computed(() => {
    return this.settings()?.workingTimeLeft ?? 8;
  });

  public workingHours: Signal<number> = computed(() => {
    return this.settings()?.defaultWorkingHours ?? 8;
  });

  public primeTimeStartHour: Signal<number> = computed(() => {
    return this.settings()?.primeTimeStartHour ?? 10;
  });

  public primeTimeEndHour: Signal<number> = computed(() => {
    return this.settings()?.primeTimeEndHour ?? 18;
  });

  // 🎯 Hilfsmethode zur dynamischen Titel-Generierung anhand der geänderten Keys
  private getSettingsChangeTitle(changes: Partial<UserSettings>): string {
    const parts: string[] = [];
    if (changes.userEnergy !== undefined) parts.push(`Energielevel (${changes.userEnergy})`);
    if (changes.workingTimeLeft !== undefined) parts.push(`Restzeit (${changes.workingTimeLeft}h)`);
    if (changes.defaultWorkingHours !== undefined) parts.push(`Arbeitszeit (${changes.defaultWorkingHours}h)`);
    if (changes.primeTimeStartHour !== undefined || changes.primeTimeEndHour !== undefined) parts.push('Fokuszeit');

    return parts.length > 0 ? parts.join(', ') : 'Allgemeine Einstellungen';
  }

  // ==========================================
  // PUBLIC ACTIONS FOR UI
  // ==========================================

public updateSettings(changes: Partial<UserSettings>): void {
    const userId = this.authContext.getCurrentUserId();
    if (!userId) return;

    // 📸 1. Snapshot des ALTE ZUSTANDES vor der Änderung holen
    const snapshot = this.stateProvider.createSnapshot();
    const changeTitle = this.getSettingsChangeTitle(changes);

    // ⚡ 2. StateProvider aktualisieren (cloneWith/merge passiert intern im Provider)
    this.stateProvider.applyActionPayload('UPDATE_SETTINGS', { userId, changes });

    // 📦 3. Das VOLLSTÄNDIGE neue UserSettings-Objekt direkt aus dem Provider holen
    const updatedSettings = this.stateProvider.getState() as UserSettings;

    // 📥 4. Kompaktes, vollständiges Payload an die Queue übergeben
    const payload: UserSettingsPayload = {
      id: userId,
      userId,
      settings: updatedSettings,
      snapshot: snapshot || undefined,
      displayInfo: {
        category: 'Einstellungen',
        title: changeTitle
      }
    };

    this.queueService.enqueue(this.serviceName, 'UPDATE_SETTINGS', payload);
  }

  // Convenience-Methoden fürs UI:
  public setUserEnergy(energy: UserEnergyLevel): void {
    this.updateSettings({ userEnergy: energy });
  }

  public setWorkingTimeLeft(hours: number): void {
    this.updateSettings({ workingTimeLeft: hours });
  }

  public changeWorkingTimeLeft(hours: number): void {
    this.setWorkingTimeLeft(hours);
  }

  public changeDefaultWorkingHours(hours: number): void {
    this.updateSettings({ defaultWorkingHours: hours });
  }

  public changePrimeTimeStart(hour: number): void {
    this.updateSettings({ primeTimeStartHour: hour });
  }

  public changePrimeTimeEnd(hour: number): void {
    this.updateSettings({ primeTimeEndHour: hour });
  }

  // ==========================================
  // QUEUE EXECUTION & FETCH
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    if (item.action === 'UPDATE_SETTINGS') {
      const payload = item.payload as UserSettingsPayload;
      const userId = payload?.userId || this.authContext.getCurrentUserId();

      if (!userId) return of(false);

      const currentState = this.stateProvider.getState() as UserSettings;

      // Domain Model -> DTO für Repository
      const dto: PlannerSettingsDto = {
        userId,
        defaultWorkingHours: currentState?.defaultWorkingHours ?? 8,
        primeTimeStartHour: currentState?.primeTimeStartHour ?? 10,
        primeTimeEndHour: currentState?.primeTimeEndHour ?? 18
      };

      return this.userRepository.updateSettings(userId, dto);
    }
    return of(true);
  }

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.userRepository.getSettings(userId).pipe(
      tap((dto: PlannerSettingsDto) => {
        // Current state behalten für lokale Felder wie workingTimeLeft / energy
        const current = this.stateProvider.getState() as UserSettings | null;

        // DTO -> Domain Model Mapper
        const settings = new UserSettings(
          userId,
          dto.defaultWorkingHours,
          dto.primeTimeStartHour,
          dto.primeTimeEndHour,
          current?.workingTimeLeft ?? dto.defaultWorkingHours,
          current?.userEnergy ?? 'MEDIUM'
        );

        this.stateProvider.applyActionPayload('SET_SETTINGS', { settings });
      }),
      map(() => void 0)
    );
  }
}