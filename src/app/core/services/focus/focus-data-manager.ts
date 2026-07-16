import { Injectable, inject, effect } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ConnectionService } from '../connection/connection-service';
import { GamificationRepository } from '../../repositories/gamification-repsoitory';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { GamificationResult } from '../../models/gamification';

@Injectable({
  providedIn: 'root'
})
export class FocusDataManagerService {
  private gamificationRepository = inject(GamificationRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService);
  private loggerService = inject(LoggerService);

  private readonly OFFLINE_POMODORO_KEY = 'offline_pomodoro_queue';

  constructor() {
    // 🛰️ Der automatische Sync-Wächter:
    effect(() => {
      if (this.connectionService.status() === 'ONLINE') {
        this.syncOfflinePomodoros();
      }
    });
  }

  /**
   * Registriert ein beendetes Pomodoro-Intervall (Offline-sicher!)
   */
  public recordCompletedPomodoro(todoId: string): Observable<GamificationResult | null> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return of(null);

    // 🚂 Szenario A: Im Zug (Offline)
    if (this.connectionService.status() === 'OFFLINE') {
      this.pushToOfflineQueue({ todoId, timestamp: Date.now() });
      this.loggerService.info('FocusDataManager', 'Pomodoro offline im Speicher gesichert.');
      return of(null); 
    }

    // 🌐 Szenario B: Online (Direkt ans Backend funken)
    return this.gamificationRepository.sendPomodoroSession(userId, { todoId, count: 1 }).pipe(
      tap(gamificationResult => {
        if (gamificationResult) {
          // Reaktiv den Header updaten mit den neuen XP und dem neuen KI-Titel!
          this.userService.updateGamification(gamificationResult);
          this.loggerService.info('FocusDataManager', 'Pomodoro online verbucht. XP erhalten!');
        }
      }),
      catchError(err => {
        this.loggerService.warn('FocusDataManager', 'Fehler beim Online-Senden, sichere offline...', err);
        this.pushToOfflineQueue({ todoId, timestamp: Date.now() });
        return throwError(() => err);
      })
    );
  }

  /**
   * Sendet die gepufferten Offline-Pomodoros gesammelt zum Server
   */
  private syncOfflinePomodoros(): void {
    const userId = this.userService.getCurrentUserId();
    const queue = this.getOfflineQueue();
    if (!userId || queue.length === 0) return;

    this.loggerService.info('FocusDataManager', `Bulk-Sync startet für ${queue.length} Offline-Pomodoros...`);

    this.gamificationRepository.sendPomodoroBulk(userId, queue).subscribe({
      next: (gamificationResult) => {
        if (gamificationResult) {
          this.userService.updateGamification(gamificationResult);
        }
        this.clearOfflineQueue();
        this.loggerService.info('FocusDataManager', 'Sämtliche Offline-Pomodoros erfolgreich nachsynchronisiert!');
      },
      error: (err) => {
        this.loggerService.error('FocusDataManager', 'Fehler beim Pomodoro-Bulk-Sync', err);
      }
    });
  }

  // --- Lokale Hilfsfunktionen für den LocalStorage ---
  private getOfflineQueue(): any[] {
    const data = localStorage.getItem(this.OFFLINE_POMODORO_KEY);
    return data ? JSON.parse(data) : [];
  }

  private pushToOfflineQueue(item: any): void {
    const queue = this.getOfflineQueue();
    queue.push(item);
    localStorage.setItem(this.OFFLINE_POMODORO_KEY, JSON.stringify(queue));
  }

  private clearOfflineQueue(): void {
    localStorage.removeItem(this.OFFLINE_POMODORO_KEY);
  }
}