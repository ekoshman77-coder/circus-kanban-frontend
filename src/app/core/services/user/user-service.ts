import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { UserRepository, IUser } from '../../repositories/user-repository';
import { LocalStorageService } from './local-storage-service';
import { GamificationResult } from '../../models/gamification';
import { catchError, map, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { UserModel } from '../../models/user-model';
import { IAuthContext } from './auth-context';

@Injectable({
  providedIn: 'root',
})
export class UserService implements IAuthContext {
  private storageService = inject(LocalStorageService);
  private userRepository = inject(UserRepository);

  private currentUserSignal = signal< UserModel | null >(null);

  public currentUser = computed(() => this.currentUserSignal());
  public isLoggedIn = computed(() => this.currentUserSignal() !== null);
  public warnings = signal< string[] | null >(null);

  public readonly onLogout$ = new Subject< void >();

  public gamificationSignal = signal< GamificationResult >({
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

    const savedJson = this.storageService.getItem< IUser >(LocalStorageService.KEYS.USER_SESSION);
    if (savedJson) {
      const savedUser = UserModel.fromJson(savedJson);
      this.currentUserSignal.set(savedUser);
    } else {
      console.warn('⚠️ [UserService] Kein User im Cache gefunden!');
    }

    const savedGamification = this.storageService.getItem< GamificationResult >(LocalStorageService.KEYS.GAMIFICATION);
    if (savedGamification) {
      this.gamificationSignal.set(savedGamification);
    }
  }

  public getCurrentUserId(): string | null {
    return this.currentUserSignal()?.id || null;
  }

  public updateGamification(result: GamificationResult): void {
    this.gamificationSignal.set(result);
    this.storageService.setItem(LocalStorageService.KEYS.GAMIFICATION, result);
  }

  public fetchCurrentStatus(): Observable< UserModel | null > {
    const currentId = this.currentUser()?.id;
    if (!currentId) return of(null);

    return this.userRepository.getUserStatus(currentId).pipe(
      map(json => (json) ? UserModel.fromJson(json) : null),
      tap((updatedUser) => {
        if (updatedUser) {
          this.saveSession(updatedUser);
        }
      })
    );
  }

  public login(username: string, password: string): Observable< UserModel | null > {
    return this.logout().pipe(
      switchMap((canProceed) => {
        if (!canProceed) return of(null);

        return this.userRepository.login(username, password).pipe(
          map((json) => UserModel.fromJson(json)),
          tap((user) => {
            this.saveSession(user);
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
        if (err.status === 404 || err.status === 401) {
          this.logout();
        }
      }
    });
  }

  public register(username: string, firstName: string, lastName: string, password: string): Observable< UserModel | null > {
    return this.logout().pipe(
      switchMap((canProceed) => {
        if (!canProceed) return of(null);

        return this.userRepository.register(username, firstName, lastName, password).pipe(
          map((json) => UserModel.fromJson(json)),
          tap((user) => {
            this.saveSession(user);
            this.loadGamificationFromBackend(user.id);
          })
        );
      })
    );
  }

  public cancelLogout(): void {
    this.warnings.set(null);
  }

  public logout(): Observable< boolean > {
    console.log('=== 🧹 LOGOUT: Bereinige alle Session-Daten ===');
    if (this.warnings() === null) {
      this.warnings.set(this.storageService.collectUnsavedDataWarnings());
      if (this.warnings() && this.warnings()!.length > 0) {
        return of(false);
      }
    }

    this.warnings.set(null);
    this.storageService.clearAllSessionData();
    this.onLogout$.next();
    this.currentUserSignal.set(null);

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
        return of(true);
      })
    );
  }

  private saveSession(user: UserModel): void {
    this.storageService.setItem(LocalStorageService.KEYS.USER_SESSION, user.toJson());
    this.currentUserSignal.set(user);
  }
}