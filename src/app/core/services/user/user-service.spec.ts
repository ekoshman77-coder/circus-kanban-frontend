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
      collectUnsavedDataWarnings: vi.fn().mockReturnValue(null)
    };

    // Statische KEYS an den Mock heften
    (mockStorageService as any).KEYS = {
      USER_SESSION: 'user_session',
      GAMIFICATION: 'gamification'
    };

    (LocalStorageService as any).KEYS = {
      USER_SESSION: 'user_session',
      GAMIFICATION: 'gamification'
    };

    // 2. Definition des Mock-Verhaltens für das Repository
    mockUserRepository = {
      getUserStatus: vi.fn().mockReturnValue(of(null)),
      getGamification: vi.fn().mockReturnValue(of({
        currentXp: 0,
        currentLevel: 0,
        levelUp: false,
        levelTitle: 'To-Do-Lehrling',
        levelIcon: '👶',
        currentLevelXpStart: 0,
        nextLevelXpRequired: 100
      })),
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
    
    TestBed.flushEffects();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  it('sollte standardmäßig nicht eingeloggt sein', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('sollte beim Logout alle Session-Daten löschen', () => {
    mockStorageService.collectUnsavedDataWarnings.mockReturnValue(null);

    service.logout();
    
    expect(mockStorageService.clearAllSessionData).toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
  });
});