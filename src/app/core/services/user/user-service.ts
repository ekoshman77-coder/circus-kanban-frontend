import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { UserRepository, IUser, PlannerSettingsDto } from '../../repositories/user-repository';
import { LocalStorageService } from './local-storage-service';
import { GamificationResult } from '../../models/gamification';
import { catchError, map, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { UserModel } from '../../models/user-model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private storageService = inject(LocalStorageService);
  private userRepository = inject(UserRepository);

  private currentUserSignal = signal<UserModel | null>(null);

  public currentUser = computed(() => this.currentUserSignal());
  public isLoggedIn = computed(() => this.currentUserSignal() !== null);
  public warnings = signal<string[] | null>(null)

  // 📻 Der Event-Kanal für den Logout-Funkspruch
  public readonly onLogout$ = new Subject<void>();

  // Zustand für den Browser-Speicher (LocalStorage)
  userEnergy = signal<'low' | 'normal' | 'high'>('normal');
  workingTimeLeft = signal<number>(8);

  // Zustand aus der Kotlin-Datenbank
  primeTimeStartHour = signal<number>(10);
  primeTimeEndHour = signal<number>(18);
  workingHours = signal<number>(8);

  public gamificationSignal = signal<GamificationResult>({
    currentXp: 0,
    currentLevel: 0,
    levelUp: false,
    levelTitle: 'To-Do-Lehrling',
    levelIcon: '👶',
    currentLevelXpStart: 0,
    nextLevelXpRequired: 100
  });

  public isAdmin = computed(() => {
    return this.currentUser()?.isAdmin() ?? false;
  });

  constructor() {
    console.log('=== 🚀 APP-START: UserService Constructor läuft an ===');

    // 1. Session über den neuen Service wiederherstellen
console.log('=== 🚀 UserService Constructor läuft an ===');

  const savedJson = this.storageService.getItem<IUser>(LocalStorageService.KEYS.USER_SESSION);
  if (savedJson) {
    const savedUser = UserModel.fromJson(savedJson);
    console.log('📦 [UserService] User aus Cache wiederhergestellt:', savedUser);
    console.log('🏢 [UserService] Department-Objekt:', savedUser.department);
    console.log('👑 [UserService] Ist Admin?:', savedUser.isAdmin());
    
    this.currentUserSignal.set(savedUser);
    this.loadSettingsFromBackend(savedUser.id);
  } else {
    console.warn('⚠️ [UserService] Kein User im Cache gefunden!');
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

  public fetchCurrentStatus(): Observable<UserModel| null> {
    const currentId = this.currentUser()?.id;

    // Wenn gar kein User eingeloggt ist, direkt abbrechen
    if (!currentId) return of(null);

    // Wir rufen das Repository auf (das bauen wir gleich)
    return this.userRepository.getUserStatus(currentId).pipe(
      map(json => (json)? UserModel.fromJson(json) : null),
      tap((updatedUser) => {
        if (updatedUser) {
          this.saveSession(updatedUser)
        }
      })
    );
  }

  public login(username: string, password: string): Observable<UserModel | null> {
    // 🔗 Wir ketten das asynchrone Logout vor den Login
    return this.logout().pipe(
      switchMap((canProceed) => {
        if (!canProceed) {
          return of(null); // 🛑 Schranke 1. Mal: Login bricht sauber ab
        }

        // 🚀 2. Mal (oder wenn sauber): Der echte Login-Request startet
        return this.userRepository.login(username, password).pipe(
          map((json) => UserModel.fromJson(json)),
          tap((user) => {
            this.saveSession(user);
            this.loadSettingsFromBackend(user.id);
            this.loadGamificationFromBackend(user.id);
          })
        );
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

  public register(username: string, firstName: string, lastName: string, password: string): Observable<UserModel | null> {
    // 🔗 Exakt dieselbe reaktive Kette für die Registrierung
    return this.logout().pipe(
      switchMap((canProceed) => {
        if (!canProceed) {
          return of(null); // 🛑 Schranke 1. Mal
        }

        // 🚀 2. Mal (oder wenn sauber): Der echte Register-Request startet
        return this.userRepository.register(username, firstName, lastName, password).pipe(
          map((json) => UserModel.fromJson(json)),
          tap((user) => {
            this.saveSession(user);
            this.loadSettingsFromBackend(user.id);
            this.loadGamificationFromBackend(user.id);
          })
        );
      })
    );
  }

  public cancelLogout(): void {
    this.warnings.set(null); // Setzt die State Machine sauber zurück
  }

  public logout(): Observable<boolean> {
    console.log('=== 🧹 LOGOUT: Bereinige alle Session-Daten ===');
    if (this.warnings() === null) {
      this.warnings.set(this.storageService.collectUnsavedDataWarnings());
      // Falls das Array existiert und Warnungen enthält -> stoppen!
      if (this.warnings() && this.warnings()!.length > 0) {
        return of(false);
      }
    }

    this.warnings.set(null);
    this.storageService.clearAllSessionData();
    this.onLogout$.next();
    this.currentUserSignal.set(null);

    this.userEnergy.set('normal');
    this.workingTimeLeft.set(8);
    this.primeTimeStartHour.set(10);
    this.primeTimeEndHour.set(18);
    this.workingHours.set(8);
    this.gamificationSignal.set({
      currentXp: 0,
      currentLevel: 0,
      levelUp: false,
      levelTitle: 'To-Do-Lehrling',
      levelIcon: '👶',
      currentLevelXpStart: 0,
      nextLevelXpRequired: 100
    });
    return this.userRepository.logout().pipe(
      map(() => true),
      catchError((err) => {
        console.warn('⚠️ Server-Logout fehlgeschlagen, wir machen trotzdem optimistisch weiter:', err);
        return of(true); // 🔥 DER TRICK: Selbst bei Fehler sagen wir "true", damit der Login nicht blockiert!
      })
    );
  }

  private saveSession(user: UserModel): void {
    this.storageService.setItem(LocalStorageService.KEYS.USER_SESSION, user.toJson());
    this.currentUserSignal.set(user);
  }
}