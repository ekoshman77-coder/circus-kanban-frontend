import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { UserRepository, IUser, PlannerSettingsDto } from '../../repositories/user-repository';
import { LocalStorageService } from './local-storage-service';
import { GamificationResult } from '../../models/gamification';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private storageService = inject(LocalStorageService);
  private userRepository = inject(UserRepository);

  private currentUserSignal = signal<IUser | null>(null);

  public currentUser = computed(() => this.currentUserSignal());
  public isLoggedIn = computed(() => this.currentUserSignal() !== null);

  // Zustand für den Browser-Speicher (LocalStorage)
  userEnergy = signal<'low' | 'normal' | 'high'>('normal');
  workingTimeLeft = signal<number>(8);

  // Zustand aus der Kotlin-Datenbank
  primeTimeStartHour = signal<number>(10);
  primeTimeEndHour = signal<number>(18);
  workingHours = signal<number>(8);

  public gamificationSignal = signal<GamificationResult>({
    currentXp: 0,
    currentLevel: 1,
    levelUp: false,
    levelTitle: 'To-Do-Lehrling 👶',
    currentLevelXpStart: 0,
    nextLevelXpRequired: 100
  });

  constructor() {
    console.log('=== 🚀 APP-START: UserService Constructor läuft an ===');

    // 1. Session über den neuen Service wiederherstellen
    const savedUser = this.storageService.getItem<IUser>(LocalStorageService.KEYS.USER_SESSION);
    if (savedUser) {
      this.currentUserSignal.set(savedUser);
      this.loadSettingsFromBackend(savedUser.id);
    }

    // 2. Gamification laden
    const savedGamification = this.storageService.getItem<GamificationResult>(LocalStorageService.KEYS.GAMIFICATION);
    if (savedGamification) {
      this.gamificationSignal.set(savedGamification);
    }

    // 3. Tagesform über den neuen Service laden (Mit Fallback 'normal')
    const savedEnergy = this.storageService.getItem<'low' | 'normal' | 'high'>(LocalStorageService.KEYS.USER_ENERGY);
    if (savedEnergy) {
      this.userEnergy.set(savedEnergy);
    }

    const savedTimeLeft = this.storageService.getItem<number>(LocalStorageService.KEYS.WORKING_TIME_LEFT);
    if (savedTimeLeft) {
      this.workingTimeLeft.set(savedTimeLeft);
    }

    // Automatische Synchronisation bei Signal-Änderungen
    effect(() => {
      this.storageService.setItem(LocalStorageService.KEYS.USER_ENERGY, this.userEnergy());
      this.storageService.setItem(LocalStorageService.KEYS.WORKING_TIME_LEFT, this.workingTimeLeft());
    });
  }

  public getCurrentUserId(): string | null {
    return this.currentUserSignal()?.id || null;
  }

  // Methode, um das Signal upzudaten und lokal im Browser zu sichern
  public updateGamification(result: GamificationResult): void {
    this.gamificationSignal.set(result);
    this.storageService.setItem(LocalStorageService.KEYS.GAMIFICATION, result);
  }

  private loadSettingsFromBackend(userId: string): void {
    this.userRepository.getSettings(userId).subscribe({
      next: (settings) => {
        this.primeTimeStartHour.set(settings.primeTimeStartHour);
        this.primeTimeEndHour.set(settings.primeTimeEndHour);
        this.workingHours.set(settings.defaultWorkingHours);

        if (!this.storageService.getItem(LocalStorageService.KEYS.WORKING_TIME_LEFT)) {
          this.workingTimeLeft.set(settings.defaultWorkingHours);
        }
      },
      error: (err) => {
        console.error('Fehler beim Laden der DB-Settings:', err);
        // 🎯 HIER: Wenn der User in der DB fehlt (z.B. 404), sofort ausloggen!
        if (err.status === 404 || err.status === 401) {
          console.warn('User nicht mehr in DB vorhanden. Melde ab...');
          this.logout();
        }
      }
    });
  }

  public changeWorkingTimeLeft(hours: number) {
    this.workingTimeLeft.set(hours);
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

  private persistSettingsToBackend(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const body: PlannerSettingsDto = {
      userId: userId,
      defaultWorkingHours: this.workingHours(),
      primeTimeStartHour: this.primeTimeStartHour(),
      primeTimeEndHour: this.primeTimeEndHour()
    };

    this.userRepository.updateSettings(userId, body).subscribe({
      next: (updated) => {
        this.workingHours.set(updated.defaultWorkingHours);
        this.primeTimeStartHour.set(updated.primeTimeStartHour);
        this.primeTimeEndHour.set(updated.primeTimeEndHour);
      },
      error: (err) => console.error('Fehler beim automatischen Speichern der DB-Settings:', err)
    });
  }

  public login(username: string, password: string): Observable<IUser> {
    return this.userRepository.login(username, password).pipe(
      tap((user) => {
        this.saveSession(user);
        this.loadSettingsFromBackend(user.id);
        this.loadGamificationFromBackend(user.id);
      })
    );
  }

  private loadGamificationFromBackend(userId: string): void {
    this.userRepository.getGamification(userId).subscribe({
      next: (state) => this.updateGamification(state),
      error: (err) => {
        console.error('Fehler beim Laden der Gamification-Daten:', err);
        // 🎯 HIER EBENSO: Sicherheitshalber auch bei den Gamification-Daten prüfen
        if (err.status === 404 || err.status === 401) {
          this.logout();
        }
      }
    });
  }

  public register(username: string, firstName: string, lastName: string, password: string): Observable<IUser> {
    return this.userRepository.register(username, firstName, lastName, password).pipe(
      tap((user) => {
        this.saveSession(user);
        this.loadSettingsFromBackend(user.id);
        this.loadGamificationFromBackend(user.id);
      })
    );
  }

  public logout(): void {
    console.log('=== 🧹 LOGOUT: Bereinige alle Session-Daten ===');

    // 🌟 Ein einziger Aufruf löscht jetzt alle definierten Keys im StorageService!
    this.storageService.clearAllSessionData();

    // Signale zurücksetzen
    this.currentUserSignal.set(null);
  }

  private saveSession(user: IUser): void {
    this.storageService.setItem(LocalStorageService.KEYS.USER_SESSION, user);
    this.currentUserSignal.set(user);
  }
}