import { inject, Injectable, signal, computed, effect } from '@angular/core';
import { UserService } from '../user/user-service';
import { CentralQueueService } from '../central-queue/central-queue-service';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private userService = inject(UserService);
  private queueService = inject(CentralQueueService);

  // Exponiert das Signal aus dem CentralQueueService
  public isLaborMode = this.queueService.isLaborMode;

  // Prüft, ob der User aufgrund seiner Rolle (z. B. Praktikant / Gast) gezwungen im Labor ist
  public isLaborForced = computed(() => {
    const user = this.userService.currentUser();
    // Beispielhafte Rollenprüfung – lässt sich beliebig erweitern
    return user?.departmentRole === 'INTERN' || user?.departmentRole === 'GUEST';
  });

  /**
   * 🎯 Wird nach dem erfolgreichen Login in der UI aufgerufen
   */
  public initializeUserSession(): Observable<void> {
    if (this.isLaborForced()) {
      console.log('🔒 [AppState] Praktikant/Gast eingeloggt. Starte Live-Fetch & Versiegelung...');
      return this.queueService.bootstrapLiveAndSealLabor();
    }
    return of(void 0);
  }
  
  /**
   * Manueller Toggle für reguläre User/Admins
   */
  public toggleLaborMode(): void {
    if (this.isLaborForced()) {
      console.warn('⚠️ [AppState] Labor-Modus kann für diese Rolle nicht deaktiviert werden.');
      return;
    }
    this.queueService.toggleLaborMode();
  }
}