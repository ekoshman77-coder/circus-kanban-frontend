import { computed, Injectable, signal, NgZone, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, interval } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { healthApiUrl } from '../../repositories/links';

/** Der aktuelle Zustand der Netzwerkverbindung. */
export type ConnectionStatus = 'UNKNOWN' | 'ONLINE' | 'OFFLINE';

/**
 * Service zur intelligenten Überwachung des Netzwerkstatus.
 * * Kombiniert Browserevents (`online`/`offline`) mit regelmäßigen Server-Pings (Health Checks).
 * * **Performance-Meisterleistung:** Der Health-Check-Loop läuft außerhalb der Angular-Zone (`runOutsideAngular`).
 * Dadurch wird verhindert, dass Angular bei jedem Intervall-Tick unnötige Change-Detection-Zyklen
 * auslöst, was besonders auf Mobilgeräten extrem akkuschonend ist.
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  private zone = inject(NgZone);

  /** Signal, das den präzisen Verbindungsstatus hält */
  public status = signal<ConnectionStatus>('UNKNOWN');

  /** Read-Only Signal: `true`, wenn die App aktiv online ist */
  public isOnline = computed(() => this.status() === 'ONLINE');

  /** Read-Only Signal: `true`, wenn die App aktiv offline ist */
  public isOffline = computed(() => this.status() === 'OFFLINE');

  constructor(private http: HttpClient) {
    // Initialer Health-Check beim App-Start
    this.checkRealConnection().subscribe();

    // Loop außerhalb der NgZone starten, um die App-Performance nicht zu beeinträchtigen
    this.zone.runOutsideAngular(() => {
      this.initServerHealthCheckLoop();
    });

    this.initConnectionListeners();
  }

  /**
   * Führt einen echten HTTP-Ping (Health Check) gegen das Backend aus.
   * Aktualisiert bei Statusänderungen das Signal innerhalb der Angular-Zone.
   * * @returns Ein Observable mit `true`, wenn der Server erreichbar ist, sonst `false`.
   */
  public checkRealConnection(): Observable<boolean> {
    return this.http.get(healthApiUrl, { responseType: 'text' }).pipe(
      map(() => true),
      catchError(() => of(false)),
      tap((serverErreichbar: boolean) => {
        const neuerStatus: ConnectionStatus = serverErreichbar ? 'ONLINE' : 'OFFLINE';
        
        // UI-Update wird nur bei tatsächlichen Änderungen in die Angular-Zone geschleust
        if (this.status() !== neuerStatus) {
          this.zone.run(() => {
            this.status.set(neuerStatus);
          });
        }
      })
    );
  }

  /**
   * Startet ein zyklisches Intervall (alle 30 Sekunden) für den Server-Ping[cite: 5].
   */
  private initServerHealthCheckLoop(): void {
    interval(30000).pipe(
      switchMap(() => this.checkRealConnection())
    ).subscribe();
  }

  /**
   * Lauscht auf die systemweiten Verbindungsänderungen des Browsers (Navigator Online/Offline)[cite: 5].
   */
  private initConnectionListeners(): void {
    window.addEventListener('offline', () => {
      this.zone.run(() => this.status.set('OFFLINE'));
    });

    window.addEventListener('online', () => {
      this.zone.run(() => this.status.set('UNKNOWN'));
      this.zone.runOutsideAngular(() => {
        this.checkRealConnection().subscribe();
      });
    });
  }
}