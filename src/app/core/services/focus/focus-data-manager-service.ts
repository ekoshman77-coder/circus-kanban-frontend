import { Injectable, inject, effect } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ConnectionService } from '../connection/connection-service';
import { GamificationRepository } from '../../repositories/gamification-repsoitory';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { GamificationResult } from '../../models/gamification';

/**
 * Service für das Offline-sichere Tracken und Synchronisieren von Fokus-Zeiten (Pomodoro).
 * * **Architektur-Highlight (Offline-First):** 
 * - Bei aktiver Verbindung werden Pomodoros direkt ans Backend gefunkt.
 * - Ist der Nutzer offline (z. B. im Zug), werden Sitzungen in einer LocalStorage-Warteschlange gepuffert.
 * - Ein reaktiver Angular-Wächter (`effect`) überwacht den Online-Status und stößt vollautomatisch 
 *   einen Bulk-Sync an, sobald die Verbindung wiederhergestellt ist.
 */
@Injectable({
  providedIn: 'root'
})
export class FocusDataManagerService {
  private gamificationRepository = inject(GamificationRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService);
  private loggerService = inject(LoggerService);

  /** Schlüssel für die Offline-Warteschlange im LocalStorage */
  private readonly OFFLINE_POMODORO_KEY = 'offline_pomodoro_queue';

  constructor() {
    // 🛰️ Der automatische Sync-Wächter:
    // Lauscht reaktiv auf Statusänderungen des ConnectionService.
    // Sobald wir ONLINE gehen, triggern wir die Nachsynchronisation.
    effect(() => {
      if (this.connectionService.status() === 'ONLINE') {
        this.syncOfflinePomodoros();
      }
    });
  }

  /**
   * Registriert ein erfolgreich beendetes Pomodoro-Intervall.
   * Speichert die Session bei Offline-Zustand lokal ab, um Datenverlust zu verhindern.
   * * @param todoId Die ID der verknüpften Aufgabe.
   * @returns Ein Observable mit dem Gamification-Ergebnis (XP, Level-Ups) oder `null`.
   */
  public recordCompletedPomodoro(todoId: string): Observable<GamificationResult | null> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return of(null);

    // 🚂 Szenario A: Offline-Modus
    if (this.connectionService.status() === 'OFFLINE') {
      this.pushToOfflineQueue({ todoId, timestamp: Date.now() });
      this.loggerService.info('FocusDataManager', 'Pomodoro offline im Speicher gesichert.');
      return of(null); 
    }

    // 🌐 Szenario B: Online-Modus (Direkt ans Backend senden)
    return this.gamificationRepository.sendPomodoroSession(userId, { todoId, count: 1 }).pipe(
      tap(gamificationResult => {
        if (gamificationResult) {
          // Gamification-Daten im Header (XP, Level, Titel) reaktiv aktualisieren
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
   * Sendet sämtliche lokal gepufferten Offline-Pomodoros als Sammelübertragung (Bulk)
   * an den Server und leert bei Erfolg die Warteschlange[cite: 7].
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

  /** Holt die aktuelle Offline-Warteschlange aus dem Speicher[cite: 7]. */
  private getOfflineQueue(): any[] {
    const data = localStorage.getItem(this.OFFLINE_POMODORO_KEY);
    return data ? JSON.parse(data) : [];
  }

  /** Fügt einen neuen Eintrag an das Ende der Offline-Warteschlange an[cite: 7]. */
  private pushToOfflineQueue(item: any): void {
    const queue = this.getOfflineQueue();
    queue.push(item);
    localStorage.setItem(this.OFFLINE_POMODORO_KEY, JSON.stringify(queue));
  }

  /** Löscht die Offline-Warteschlange vollständig[cite: 7]. */
  private clearOfflineQueue(): void {
    localStorage.removeItem(this.OFFLINE_POMODORO_KEY);
  }
}