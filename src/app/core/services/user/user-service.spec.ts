import { TestBed } from '@angular/core/testing';
import { UserService } from './user-service';
import { LocalStorageService } from './local-storage-service';
import { UserRepository } from '../../repositories/user-repository';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

describe('UserService', () => {
  let service: UserService;
  
  // Wir erstellen Mock-Objekte für unsere injizierten Services
  let mockStorageService: any;
  let mockUserRepository: any;

  beforeEach(() => {
    // 1. Definition des Mock-Verhaltens für den LocalStorage
    mockStorageService = {
      getItem: vi.fn().mockReturnValue(null), // Standardmäßig liefert der Speicher "nichts" zurück
      setItem: vi.fn(),
      clearAllSessionData: vi.fn()
    };

    // 2. Definition des Mock-Verhaltens für das Repository
    mockUserRepository = {
      getSettings: vi.fn().mockReturnValue(of({
        primeTimeStartHour: 9,
        primeTimeEndHour: 17,
        defaultWorkingHours: 8
      })),
      updateSettings: vi.fn(),
      getGamification: vi.fn()
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
    service.logout();
    
    // Prüfen, ob der StorageService angewiesen wurde, alles zu leeren
    expect(mockStorageService.clearAllSessionData).toHaveBeenCalled();
    // Prüfen, ob der Zustand zurückgesetzt wurde
    expect(service.currentUser()).toBeNull();
  });
});