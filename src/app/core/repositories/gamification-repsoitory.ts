import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GamificationResult } from '../models/gamification'; // Pfad zu deinem Modell prüfen!
import { gamificationApiUrl } from './links';

@Injectable({
  providedIn: 'root'
})
export class GamificationRepository {
  private http = inject(HttpClient);

  /**
   * Sendet eine einzelne live beendete Fokus-Sitzung ans Backend
   */
  public sendPomodoroSession(userId: string, payload: { todoId: string; count: number }): Observable<GamificationResult> {
    return this.http.post<GamificationResult>(`${gamificationApiUrl}/session`, {
      userId,
      ...payload
    });
  }

  /**
   * Sendet eine Liste von offline gesammelten Pomodoros als Paket (Bulk) ans Backend
   */
  public sendPomodoroBulk(userId: string, sessions: Array<{ todoId: string; timestamp: number }>): Observable<GamificationResult> {
    return this.http.post<GamificationResult>(`${gamificationApiUrl}/bulk`, {
      userId,
      sessions
    });
  }
}