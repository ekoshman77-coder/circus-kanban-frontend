import { computed, Injectable, signal, NgZone, inject } from '@angular/core'; // 👈 NgZone & inject importieren
import { HttpClient } from '@angular/common/http';
import { Observable, of, interval } from 'rxjs';
import { map, catchError, tap, startWith, switchMap } from 'rxjs/operators';
import { healthApiUrl } from '../repositories/links';

export type ConnectionStatus = 'UNKNOWN' | 'ONLINE' | 'OFFLINE';

@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  private zone = inject(NgZone); // 👈 Die Zone injizieren

  public status = signal<ConnectionStatus>('UNKNOWN');
  public isOnline = computed(() => this.status() === 'ONLINE');
  public isOffline = computed(() => this.status() === 'OFFLINE');

  constructor(private http: HttpClient) {
    this.checkRealConnection().subscribe();

    // 🏎️ Wir starten den Loop außerhalb von Angular! 
    // Dadurch schläft die Zone und blockiert nicht mehr bei Mausklicks.
    this.zone.runOutsideAngular(() => {
      this.initServerHealthCheckLoop();
    });

    this.initConnectionListeners();
  }

  public checkRealConnection(): Observable<boolean> {
    return this.http.get(healthApiUrl, { responseType: 'text' }).pipe(
      map(() => true),
      catchError(() => of(false)),
      tap((serverErreichbar: boolean) => {
        const neuerStatus: ConnectionStatus = serverErreichbar ? 'ONLINE' : 'OFFLINE';
        
        // Nur wenn sich der Status geändert hat, updaten wir das Signal INSIDE Angular
        if (this.status() !== neuerStatus) {
          this.zone.run(() => {
            this.status.set(neuerStatus);
          });
        }
      })
    );
  }

  private initServerHealthCheckLoop(): void {
    interval(30000).pipe(
      switchMap(() => this.checkRealConnection())
    ).subscribe();
  }

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