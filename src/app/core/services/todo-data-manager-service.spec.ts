import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { TodoDataManagerService } from './todo-data-manager-service';
import { TodoRepository } from '../repositories/todo-repository';
import { ConnectionService } from './connection-service';
import { LocalStorageService } from './local-storage-service';
import { UserService } from './user/user-service';
import { signal } from '@angular/core'; // 🌟 WICHTIG FÜR UNSERE NEUEN TESTS
import { Todo } from '../models/todo';

if (typeof window !== 'undefined' && !window.localStorage) {
  (window as any).localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  };
}

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
});

describe('TodoDataManagerService (TDD Offline-Sperren mit Vitest)', () => {
  let service: TodoDataManagerService;
  
  // Globale Mocks für die alten Tests (bleiben exakt so wie sie vorher waren!)
  let mockTodoRepository: any;
  let mockConnectionService: any;
  let mockLocalStorageService: any;
  let mockUserService: any; // 🌟 Für die alten Tests miterstellt
  let lastSavedJson = ''; 

  beforeEach(() => {
    mockTodoRepository = {
      createTodo: vi.fn(), 
      updateTodoStatus: () => ({ pipe: () => {} }),
      deleteTodo: () => ({ pipe: () => {} }),
      updateTodo: () => ({ pipe: () => {} }),
      deleteCompleted: () => ({ pipe: () => {} }),
      deleteAll: () => ({ pipe: () => {} })
    };

    // 🛡️ REPARATUR: Bleibt ein echtes Vitest-Mock-Objekt für die alten Tests!
    mockConnectionService = {
      status: vi.fn(() => 'ONLINE'),
      checkRealConnection: () => ({ pipe: () => {} })
    };

    mockUserService = {
      currentUser: vi.fn(() => ({ id: 'user-123', username: 'TestUser' })),
      getCurrentUserId: vi.fn(() => 'user-123')
    };

    mockLocalStorageService = {
      getItem: vi.fn(() => null),
      setItem: vi.fn((key, value) => {
        if (key.startsWith('todos_')) {
          lastSavedJson = JSON.stringify(value);
        }
      }),
      removeItem: vi.fn()
    };

    // Globales Standard-Setup für bestehende Tests
    TestBed.configureTestingModule({
      providers: [
        TodoDataManagerService,
        { provide: TodoRepository, useValue: mockTodoRepository },
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: LocalStorageService, useValue: mockLocalStorageService },
        { provide: UserService, useValue: mockUserService }
      ]
    });

    // Die alten Tests erwarten, dass der Service hier global geinjectet wird
    service = TestBed.inject(TodoDataManagerService);
  });

// ==========================================
  // 🚨 ISOLIERTE ARCHITEKTUR-TESTS (RACE CONDITION SCHUTZ)
  // ==========================================

  describe('Race Condition Schutz im Constructor-Effect', () => {
    
    // 🛠️ HIER BAUEN WIR UNS EIN EIGENES, UNABHÄNGIGES INJEKTIONS-SETUP!
    function setupIsolatedRaceConditionTest(initialStatus: 'UNKNOWN' | 'ONLINE' | 'OFFLINE') {
      const localSignal = signal(initialStatus);
      
      // 🌟 Ein echtes, beschreibbares Signal für den Test-User anlegen:
      const localUserSignal = signal<{ id: string; username: string } | null>({ id: 'user-123', username: 'TestUser' });
      
      const localConnectionMock = {
        status: localSignal,
        checkRealConnection: () => ({ pipe: () => {} })
      };

      const localUserMock = {
        // Wir übergeben das steuerbare Signal direkt
        currentUser: localUserSignal,
        getCurrentUserId: () => localUserSignal()?.id || null
      };

      // Wir überschreiben die Provider NUR für diesen spezifischen Testlauf im TestBed
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TodoDataManagerService,
          { provide: TodoRepository, useValue: mockTodoRepository },
          { provide: LocalStorageService, useValue: mockLocalStorageService },
          { provide: ConnectionService, useValue: localConnectionMock },
          { provide: UserService, useValue: localUserMock }
        ]
      });

      const localService = TestBed.inject(TodoDataManagerService);
      return { localService, localSignal, localUserSignal }; // 🌟 Signal zurückgeben!
    }

    it('sollte triggerBulkSync NICHT aufrufen, wenn der Status UNKNOWN ist', () => {
      const { localService } = setupIsolatedRaceConditionTest('UNKNOWN');
      const bulkSyncSpy = vi.spyOn(localService as any, 'triggerBulkSync');

      TestBed.flushEffects();
      expect(bulkSyncSpy).not.toHaveBeenCalled();
    });

    it('sollte triggerBulkSync aufrufen, sobald der Status von UNKNOWN auf ONLINE wechselt', () => {
      const { localService, localSignal } = setupIsolatedRaceConditionTest('UNKNOWN');
      const bulkSyncSpy = vi.spyOn(localService as any, 'triggerBulkSync');

      TestBed.flushEffects();
      expect(bulkSyncSpy).not.toHaveBeenCalled();

      // Signal umschalten
      localSignal.set('ONLINE');
      TestBed.flushEffects();

      expect(bulkSyncSpy).toHaveBeenCalledWith('user-123');
    });

    it('sollte triggerBulkSync NICHT aufrufen, wenn ONLINE schaltet aber kein User angemeldet ist', () => {
      // 1. SETUP: Wir starten mit ONLINE, aber setzen das User-Signal danach sofort auf null!
      const { localService, localUserSignal } = setupIsolatedRaceConditionTest('ONLINE');
      
      // 🌟 Sauberes Entziehen des Users über die Signal-API statt Vitest-Mocks!
      localUserSignal.set(null); 
      
      const bulkSyncSpy = vi.spyOn(localService as any, 'triggerBulkSync');
      
      // 2. AKTION
      TestBed.flushEffects();

      // 3. ÜBERPRÜFUNG: Kein User, kein Sync!
      expect(bulkSyncSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // DEINE BESTEHENDEN TESTS (VÖLLIG UNBERÜHRT UND WIEDER GRÜN)
  // ==========================================

  describe('createTodo', () => {
    it('sollte online ein Todo erstellen, die Server-ID mappen und das Signal bereitstellen', async () => {
      mockConnectionService.status.mockReturnValue('ONLINE');

      const neuesTodo = new Todo({
        task: 'Online Task', 
        description: null, 
        effort: 3,
        dueDate: Date.now(),
        userId: 'user1',
        isStarted: false
      });
      const aktuelleListe: Todo[] = [];

      const dbErgebnisTodo = Todo.fromTodo(neuesTodo);
      dbErgebnisTodo.id = 'datenbank-id-123';
      dbErgebnisTodo.syncState = 'fine';

      mockTodoRepository.createTodo.mockReturnValue(of(dbErgebnisTodo));

      const ergebnisListe = await firstValueFrom(
        service.createTodo(neuesTodo, aktuelleListe)
      );

      expect(mockTodoRepository.createTodo).toHaveBeenCalledWith(neuesTodo);
      expect(ergebnisListe.length).toBe(1);
      expect(ergebnisListe[0].id).toBe('datenbank-id-123');
      expect(ergebnisListe[0].syncState).toBe('fine');
    });
  });
});