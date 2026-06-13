import { computed, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, interval } from 'rxjs';
import { map, catchError, tap, startWith, switchMap } from 'rxjs/operators';
import { healthApiUrl } from '../repositories/links';

export type ConnectionStatus = 'UNKNOWN' | 'ONLINE' | 'OFFLINE';

@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  // 🎯 Das einzige Signal für den globalen Zustand
  public status = signal<ConnectionStatus>('UNKNOWN');
/**
   * Gibt true zurück, wenn der Status exakt ONLINE ist
   * (Wird oft in der UI genutzt, um grüne Punkte oder Sync-Icons anzuzeigen)
   */
  public isOnline = computed(() => this.status() === 'ONLINE');

  /**
   * Gibt true zurück, wenn der Status exakt OFFLINE ist
   * (Wird oft genutzt, um Banner wie "Du bist im Offline-Modus" einzublenden)
   */
  public isOffline = computed(() => this.status() === 'OFFLINE');

  constructor(private http: HttpClient) {
    // 1. 🚀 Kaltstart: Sofort den schnellen, einmaligen Ping ausführen!
    this.checkRealConnection().subscribe();

    // 2. 🔄 Dauerüberwachung: Das regelmäßige Intervall starten
    this.initServerHealthCheckLoop();

    // 3. 🔌 Live-Listener für Betriebssystem-Wechsel (WLAN an/aus)
    this.initConnectionListeners();
  }

  /**
   * ⚡ DER SCHNELLE EINMALIGE CHECK
   * Wird beim Start und bei WLAN-Reconnects aufgerufen.
   */
  public checkRealConnection(): Observable<boolean> {
    return this.http.get(healthApiUrl, { responseType: 'text' }).pipe(
      map(() => true),
      catchError(() => of(false)),
      tap((serverErreichbar: boolean) => {
        // Direkt den Status im Signal setzen
        this.status.set(serverErreichbar ? 'ONLINE' : 'OFFLINE');
      })
    );
  }

  /**
   * 🕒 DAUERÜBERWACHUNG (Intervall)
   * Holt regelmäßig den Status ab, während die App läuft.
   */
  private initServerHealthCheckLoop(): void {
    // Alle 30 Sekunden (oder dein gewünschtes Intervall) den Server prüfen
    interval(30000).pipe(
      switchMap(() => this.checkRealConnection())
    ).subscribe();
  }

  /**
   * 🌐 BROWSER-LISTENER
   * Reagiert sofort, wenn das Betriebssystem das Netz verliert/wiederfindet.
   */
  private initConnectionListeners(): void {
    window.addEventListener('offline', () => {
      // Komplett ohne WLAN -> Sofort OFFLINE
      this.status.set('OFFLINE');
    });

    window.addEventListener('online', () => {
      // WLAN kommt wieder -> Erst UNKNOWN, dann sofort den schnellen Check jagen!
      this.status.set('UNKNOWN');
      this.checkRealConnection().subscribe();
    });
  }
}