import { inject, Injectable, effect, signal, untracked } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { UserService } from '../user/user-service';
import { DraftQueueDataManager } from '../draft-chains/draft-data-manager';
import { IUser } from '../../repositories/dto/user-dto';
import { UserModel } from '../../models/user-model';

export type GraduationTriggerSource = 'LIVE_POLLING' | 'LOGIN_REHYDRATION';

export interface GraduationEvent {
  user: UserModel;
  source: GraduationTriggerSource;
}

const APPROVING_POLLING_INTERVAL_MS = 15 * 1000; // 15 Sekunden für Warteraum
const LABOR_POLLING_INTERVAL_MS = 5 * 60 * 1000;  // 5 Minuten für Labor/Praktikanten

@Injectable({
  providedIn: 'root'
})
export class UserStatusPollingService {
  private userService = inject(UserService);
  private draftDataManager = inject(DraftQueueDataManager);

  private pollingSubscription: Subscription | null = null;

  // 🎯 Reaktive Signale für die UI
  public justApproved = signal<boolean>(false);
  public graduationPending = signal<GraduationEvent | null>(null);

  constructor() {
effect(() => {
    const isLoggedIn = this.userService.isLoggedIn();

    if (!isLoggedIn) {
      this.stopPolling();
      return;
    }

    // Einmalig beim Einloggen / Starten prüfen
    const user = untracked(() => this.userService.currentUser());
    if (!user) return;

    if (!user.isApproved || this.isLaborRole(user.departmentRole)) {
      this.startPolling(); // Startet NUR, wenn noch kein Polling läuft!
    } else if (this.hasUnmigratedSandboxDrafts()) {
      this.stopPolling();
      this.triggerGraduation(user, 'LOGIN_REHYDRATION');
    } else {
      this.stopPolling();
    }

    // HINWEIS: kein `onCleanup(() => this.stopPolling())` hier, 
    // damit Re-Evaluierungen des Effects das Polling NICHT abwürgen!
  });
  }

  // ==========================================
  // HELPER & CHECKS
  // ==========================================

  private isLaborRole(role?: string | null): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return r === 'INTERN' || r === 'GUEST' || r === 'PRAKTIKANT' || r === 'GAST';
  }

  private hasUnmigratedSandboxDrafts(): boolean {
    const drafts = this.draftDataManager.draftChainsSignal();
    return drafts.some(chain => chain.origin === 'LABOR');
  }

  // ==========================================
  // POLLING CONTROL
  // ==========================================

  private startPolling(): void {
    if (this.pollingSubscription) return;
    const user  = this.userService.currentUser();
    if (!user) return;

    const intervalTime = !user.isApproved 
    ? APPROVING_POLLING_INTERVAL_MS 
    : LABOR_POLLING_INTERVAL_MS;

        console.log(`⏱️ [UserStatusPolling] Polling gestartet (Intervall: ${intervalTime / 1000}s)`);

    this.pollingSubscription = interval(intervalTime)
      .pipe(
        startWith(0),
        switchMap(() => this.userService.fetchCurrentStatus())
      )
      .subscribe({
        next: (user) => {
          if (!user) return;

          // ⚡ A) Warteraum-Freischaltung erfolgt!
          if (user.isApproved && !this.justApproved()) {
            this.justApproved.set(true);
            setTimeout(() => this.justApproved.set(false), 100);
          }

          // ⚡ B) Live-Rollenwechsel vom Labor-Modus zum regulären Teammitglied!
          if (user.isApproved && !this.isLaborRole(user.departmentRole)) {
            console.log('🎉 [UserStatusPolling] Live-Beförderung erkannt!');
            this.stopPolling();
            this.triggerGraduation(user, 'LIVE_POLLING');
          }
        },
        error: (err) => console.error('⚠️ [UserStatusPolling] Fehler beim Status-Polling:', err)
      });
  }

  public stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
      console.log('🛑 [UserStatusPolling] Polling gestoppt.');
    }
  }

  // ==========================================
  // GRADUATION TRIGGERS & DISMISS
  // ==========================================

  private triggerGraduation(user: UserModel, source: GraduationTriggerSource): void {
    this.graduationPending.set({ user, source });
  }

  public dismissGraduation(): void {
    this.graduationPending.set(null);
  }
}