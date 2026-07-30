import { inject, Injectable, effect, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { UserService } from '../user/user-service'; 
import { NotificationService } from '../notification/notification-service'; 

@Injectable({
  providedIn: 'root'
})
export class ApprovalPollingService {
  private userService = inject(UserService);
  private pollingSubscription: Subscription | null = null;

  // 🎯 Das flüchtige Signal für die Komponente
  public justApproved = signal<boolean>(false);

  constructor() {
    effect((onCleanup) => {
      const isLoggedIn = this.userService.isLoggedIn();
      const isApproved = this.userService.currentUser()?.isApproved;

      if (isLoggedIn && !isApproved) {
        this.startPolling();
      } else {
        this.stopPolling();
      }

      onCleanup(() => this.stopPolling());
    });
  }

  private startPolling(): void {
    if (this.pollingSubscription) return;

    this.pollingSubscription = interval(10000)
      .pipe(
        startWith(0),
        switchMap(() => this.userService.fetchCurrentStatus())
      )
      .subscribe({
        next: (user) => {
          if (user && user.isApproved) {
            this.stopPolling();

            // ⚡ ZACK! Jetzt ist es passiert!
            this.justApproved.set(true);

            // Nach einem winzigen Moment (z.B. 100ms) direkt wieder zurücksetzen,
            // damit es beim nächsten Mal wieder frisch triggern kann.
            setTimeout(() => {
              this.justApproved.set(false);
            }, 100);
          }
        },
        error: (err) => console.error('Fehler beim Freischaltungs-Polling:', err)
      });
  }

  public stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }
}