import { TestBed } from '@angular/core/testing';
import { FocusDataManagerService } from './focus-data-manager-service';
import { ConnectionService } from '../connection/connection-service';
import { GamificationRepository } from '../../repositories/gamification-repsoitory';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

describe('FocusDataManagerService', () => {
  let service: FocusDataManagerService;

  // Mocks
  let mockConnectionService: any;
  let mockGamificationRepository: any;
  let mockUserService: any;
  let mockLoggerService: any;
  let connectionStatusSignal: any;

  // In-Memory LocalStorage Mock
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; }
    });

    // Wir starten im OFFLINE-Zustand, um automatische Sync-Effekte bei der Instanziierung zu kontrollieren
    connectionStatusSignal = signal<'ONLINE' | 'OFFLINE'>('OFFLINE');
    mockConnectionService = {
      status: connectionStatusSignal
    };

    mockGamificationRepository = {
      sendPomodoroSession: vi.fn().mockReturnValue(of({ xp: 100, level: 2 })),
      sendPomodoroBulk: vi.fn().mockReturnValue(of({ xp: 250, level: 3 }))
    };

    mockUserService = {
      getCurrentUserId: vi.fn().mockReturnValue('user-777'),
      updateGamification: vi.fn()
    };

    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        FocusDataManagerService,
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: GamificationRepository, useValue: mockGamificationRepository },
        { provide: UserService, useValue: mockUserService },
        { provide: LoggerService, useValue: mockLoggerService }
      ]
    });

    service = TestBed.inject(FocusDataManagerService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('recordCompletedPomodoro (Sitzung aufzeichnen)', () => {
    it('sollte im OFFLINE-Modus die Session in die lokale Queue schreiben und nicht ans Backend funken', () => {
      connectionStatusSignal.set('OFFLINE');

      service.recordCompletedPomodoro('todo-abc').subscribe((result) => {
        expect(result).toBeNull();
      });
        
      // Queue im LocalStorage überprüfen
      const queueRaw = localStorage.getItem('offline_pomodoro_queue');
      expect(queueRaw).toBeTruthy();
      
      const queue = JSON.parse(queueRaw!);
      expect(queue.length).toBe(1);
      expect(queue[0].todoId).toBe('todo-abc');

      expect(mockGamificationRepository.sendPomodoroSession).not.toHaveBeenCalled();
      expect(mockLoggerService.info).toHaveBeenCalledWith('FocusDataManager', expect.stringContaining('offline im Speicher gesichert'));
    });

    it('sollte im ONLINE-Modus direkt an das Repository senden und Gamification aktualisieren', () => {
      connectionStatusSignal.set('ONLINE');

      service.recordCompletedPomodoro('todo-xyz').subscribe((result) => {
        expect(result).toEqual({ xp: 100, level: 2 });
      });

      expect(mockGamificationRepository.sendPomodoroSession).toHaveBeenCalledWith('user-777', { todoId: 'todo-xyz', count: 1 });
      expect(mockUserService.updateGamification).toHaveBeenCalledWith({ xp: 100, level: 2 });
    });

    it('sollte bei einem Backend-Fehler im ONLINE-Modus auf die Offline-Queue zurückgreifen', () => {
      connectionStatusSignal.set('ONLINE');
      mockGamificationRepository.sendPomodoroSession.mockReturnValue(throwError(() => new Error('Server-Absturz')));

      service.recordCompletedPomodoro('todo-error').subscribe({
        error: (err) => {
          expect(err.message).toBe('Server-Absturz');
        }
      });
          
      // Queue prüfen – trotz Fehler muss es lokal gesichert sein!
      const queueRaw = localStorage.getItem('offline_pomodoro_queue');
      const queue = JSON.parse(queueRaw!);
      expect(queue.length).toBe(1);
      expect(queue[0].todoId).toBe('todo-error');
      
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });
  });

describe('Automatischer Sync über ConnectionService Signal-Wechsel', () => {
    it('sollte die Offline-Warteschlange synchronisieren, sobald wir ONLINE gehen', () => {
      // 1. Wir starten offline und befüllen die Warteschlange künstlich vorab
      const localQueue = [
        { todoId: 'todo-1', timestamp: 12345 },
        { todoId: 'todo-2', timestamp: 67890 }
      ];
      localStorage.setItem('offline_pomodoro_queue', JSON.stringify(localQueue));

      // 2. Verbindung reaktiv auf ONLINE schalten (triggert den effect im Service!)[cite: 7]
      connectionStatusSignal.set('ONLINE');

      // ⚡ HIER IST DER RETTER: Alle ausstehenden Signals-Effekte sofort abarbeiten!
      TestBed.flushEffects();

      // 3. Verifizieren, dass der Bulk-Sync jetzt erfolgreich gelaufen ist
      expect(mockGamificationRepository.sendPomodoroBulk).toHaveBeenCalledWith('user-777', localQueue);
      expect(mockUserService.updateGamification).toHaveBeenCalledWith({ xp: 250, level: 3 });
      expect(localStorage.getItem('offline_pomodoro_queue')).toBeNull(); // Die Queue muss geleert worden sein![cite: 7]
    });
  });
});