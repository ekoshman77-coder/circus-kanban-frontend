import { TestBed } from '@angular/core/testing';
import { UserService } from './user-service';
import { LocalStorageService } from './local-storage-service';
import { UserRepository } from '../../repositories/user-repository';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

describe('UserService', () => {
  let service: UserService;
  
  let mockStorageService: any;
  let mockUserRepository: any;

  beforeEach(() => {
    // 1. Definition des Mock-Verhaltens für den LocalStorage
    mockStorageService = {
      getItem: vi.fn().mockReturnValue(null), 
      setItem: vi.fn(),
      clearAllSessionData: vi.fn(),
      collectUnsavedDataWarnings: vi.fn().mockReturnValue(null) // 🌟 NEU: Verhindert Crash beim Logout
    };

    // 🛡️ REPARATUR: Die statischen KEYS an den Mock heften, damit der Constructor nicht crasht!
    (mockStorageService as any).KEYS = {
      USER_SESSION: 'user_session',
      GAMIFICATION: 'gamification',
      USER_ENERGY: 'user_energy',
      WORKING_TIME_LEFT: 'working_time_left'
    };

    // Wir patchen auch die originale Klasse (falls Angular den Typ prüft)
    (LocalStorageService as any).KEYS = {
      USER_SESSION: 'user_session',
      GAMIFICATION: 'gamification',
      USER_ENERGY: 'user_energy',
      WORKING_TIME_LEFT: 'working_time_left'
    };

    // 2. Definition des Mock-Verhaltens für das Repository
    mockUserRepository = {
      getSettings: vi.fn().mockReturnValue(of({
        primeTimeStartHour: 9,
        primeTimeEndHour: 17,
        defaultWorkingHours: 8
      })),
      updateSettings: vi.fn(),
      getGamification: vi.fn(),
      logout: vi.fn().mockReturnValue(of(true))
    };

    // 3. Angular Testbed konfigurieren und Mocks einschleusen
    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: LocalStorageService, useValue: mockStorageService },
        { provide: UserRepository, useValue: mockUserRepository }
      ]
    });

    service = TestBed.inject(UserService);
    
    // 🌟 WICHTIG FÜR SIGNALS: Den initialen Constructor-Effekt ausführen lassen
    TestBed.flushEffects();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  it('sollte standardmäßig nicht eingeloggt sein', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('sollte die verbleibende Arbeitszeit ändern können', () => {
    service.changeWorkingTimeLeft(6);
    expect(service.workingTimeLeft()).toBe(6);
  });

  it('sollte beim Logout alle Session-Daten löschen', () => {
    // Sicherstellen, dass keine ungespeicherten Daten-Warnungen vorliegen
    mockStorageService.collectUnsavedDataWarnings.mockReturnValue(null);

    service.logout();
    
    // Prüfen, ob der StorageService angewiesen wurde, alles zu leeren
    expect(mockStorageService.clearAllSessionData).toHaveBeenCalled();
    // Prüfen, ob der Zustand zurückgesetzt wurde
    expect(service.currentUser()).toBeNull();
  });
});