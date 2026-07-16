import { TestBed } from '@angular/core/testing';
import { ConnectionService, ConnectionStatus } from './connection-service';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { NgZone } from '@angular/core';

describe('ConnectionService', () => {
  let service: ConnectionService;
  
  // Mocks
  let mockHttpClient: any;
  let mockNgZone: any;

  beforeEach(() => {
    // HttpClient mocken, der standardmäßig "true" (erreichbar) meldet
    mockHttpClient = {
      get: vi.fn().mockReturnValue(of('OK'))
    };

    // NgZone mocken, damit wir prüfen können, ob Aktionen außerhalb/innerhalb ausgeführt werden
    mockNgZone = {
      runOutsideAngular: vi.fn((fn) => fn()),
      run: vi.fn((fn) => fn())
    };

    TestBed.configureTestingModule({
      providers: [
        ConnectionService,
        { provide: HttpClient, useValue: mockHttpClient },
        { provide: NgZone, useValue: mockNgZone }
      ]
    });

    service = TestBed.inject(ConnectionService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('Initialisierung', () => {
    it('sollte den Health-Check-Loop außerhalb von Angular initialisieren', () => {
      // Prüft, ob runOutsideAngular gerufen wurde, um die Performance zu schonen
      expect(mockNgZone.runOutsideAngular).toHaveBeenCalled();
    });
  });

  describe('checkRealConnection', () => {
    it('sollte den Status auf ONLINE setzen, wenn der HTTP-Ping klappt', () => {
      mockHttpClient.get.mockReturnValue(of('OK'));
      
      service.checkRealConnection().subscribe((isOnline) => {
        expect(isOnline).toBe(true);
        expect(service.status()).toBe('ONLINE');
        expect(service.isOnline()).toBe(true);
        expect(service.isOffline()).toBe(false);
      });
    });

    it('sollte den Status auf OFFLINE setzen, wenn der HTTP-Ping fehlschlägt', () => {
      mockHttpClient.get.mockReturnValue(throwError(() => new Error('Server down')));
      
      service.checkRealConnection().subscribe((isOnline) => {
        expect(isOnline).toBe(false);
        expect(service.status()).toBe('OFFLINE');
        expect(service.isOnline()).toBe(false);
        expect(service.isOffline()).toBe(true);
      });
    });
  });

describe('Browser Event Listeners', () => {
    it('sollte auf das window "offline"-Event reagieren und Status auf OFFLINE setzen', () => {
      // Wir feuern das echte Browser-Event künstlich ab
      window.dispatchEvent(new Event('offline'));

      expect(service.status()).toBe('OFFLINE');
      expect(service.isOffline()).toBe(true);
    });

    it('sollte bei einem window "online"-Event den Status zuerst auf UNKNOWN setzen und einen neuen Check triggern', () => {
      // Wir ändern den Mock temporär so ab, dass er asynchron reagiert (nicht sofort feuert!)
      // Dadurch bleibt der Status 'UNKNOWN', bis die "Netzwerkantwort" eintrifft.
      let triggerResponse!: (value: any) => void;
      mockHttpClient.get.mockReturnValue(new Observable(subscriber => {
        triggerResponse = (val) => {
          subscriber.next(val);
          subscriber.complete();
        };
      }));

      // Event feuern
      window.dispatchEvent(new Event('online'));

      // 1. Jetzt MUSS der Status UNKNOWN sein, weil der Server-Ping noch läuft!
      expect(service.status()).toBe('UNKNOWN');
      expect(mockHttpClient.get).toHaveBeenCalled();

      // 2. Erst wenn der Server antwortet...
      triggerResponse('OK');

      // 3. ...wird der Status zu ONLINE
      expect(service.status()).toBe('ONLINE');
    });
  });
});