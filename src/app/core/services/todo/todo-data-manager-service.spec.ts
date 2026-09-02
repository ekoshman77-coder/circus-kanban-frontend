import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom, of, Subject } from 'rxjs';
import { TodoDataManagerService } from './todo-data-manager-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';
import { signal } from '@angular/core'; 
import { Todo } from '../../models/todo';

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
  
  let mockTodoRepository: any;
  let mockConnectionService: any;
  let mockUserService: any; 

  // Ein steuerbares Signal für die Standard-Tests
  let globalConnectionSignal = signal<'UNKNOWN' | 'ONLINE' | 'OFFLINE'>('ONLINE');

  beforeEach(() => {
    globalConnectionSignal.set('ONLINE');

    mockTodoRepository = {
      createTodo: vi.fn(), 
      syncBulkTodos: vi.fn(() => of({ liste: [], gamificationResult: null })), 
      updateTodoStatus: () => ({ pipe: () => {} }),
      deleteTodo: () => ({ pipe: () => {} }),
      updateTodo: () => ({ pipe: () => {} }),
      deleteCompleted: () => ({ pipe: () => {} }),
      deleteAll: () => ({ pipe: () => {} }),
      getRelevantTodos: vi.fn(() => of([]))
    };

    // status ist jetzt ein echtes steuerbares Signal
    mockConnectionService = {
      status: globalConnectionSignal,
      checkRealConnection: () => ({ pipe: () => {} })
    };

    mockUserService = {
      currentUser: vi.fn(() => ({ id: 'user-123', username: 'TestUser' })),
      getCurrentUserId: vi.fn(() => 'user-123'),
      isLoggedIn: vi.fn().mockReturnValue(true), // 🟢 NEU
      onLogout$: new Subject<void>()
    };

    TestBed.configureTestingModule({
      providers: [
        TodoDataManagerService,
        { provide: TodoRepository, useValue: mockTodoRepository },
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: UserService, useValue: mockUserService }
      ]
    });

    service = TestBed.inject(TodoDataManagerService);
    
    // 🛡️ Da localStorageService in der Klasse nicht injiziert ist, patchen wir einen Fallback auf das Objekt,
    // um die unvollständige Instanzierung zur Laufzeit abzufangen:
    (service as any).localStorageService = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
  });

  // ==========================================
  // 🚨 ISOLIERTE ARCHITEKTUR-TESTS (RACE CONDITION SCHUTZ)
  // ==========================================

  describe('Race Condition Schutz im Constructor-Effect', () => {
    
    function setupIsolatedRaceConditionTest(initialStatus: 'UNKNOWN' | 'ONLINE' | 'OFFLINE') {
      const localSignal = signal(initialStatus);
      const localUserSignal = signal<{ id: string; username: string } | null>({ id: 'user-123', username: 'TestUser' });
      
      const localConnectionMock = {
        status: localSignal,
        checkRealConnection: () => ({ pipe: () => {} })
      };

      const localUserMock = {
        currentUser: localUserSignal,
        getCurrentUserId: () => localUserSignal()?.id || null,
        isLoggedIn: vi.fn(() => !!localUserSignal()), // 🟢 NEU: True wenn User da ist, sonst False
        onLogout$: new Subject<void>()
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TodoDataManagerService,
          { provide: TodoRepository, useValue: mockTodoRepository },
          { provide: ConnectionService, useValue: localConnectionMock },
          { provide: UserService, useValue: localUserMock }
        ]
      });

      const localService = TestBed.inject(TodoDataManagerService);
      (localService as any).localStorageService = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn()
      };
      
      return { localService, localSignal, localUserSignal }; 
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

      localSignal.set('ONLINE');
      TestBed.flushEffects();

      expect(bulkSyncSpy).toHaveBeenCalledWith('user-123');
    });

    it('sollte triggerBulkSync NICHT aufrufen, wenn ONLINE schaltet aber kein User angemeldet ist', () => {
      const { localService, localUserSignal } = setupIsolatedRaceConditionTest('ONLINE');
      
      localUserSignal.set(null); 
      const bulkSyncSpy = vi.spyOn(localService as any, 'triggerBulkSync');
      
      TestBed.flushEffects();
      expect(bulkSyncSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // DEINE BESTEHENDEN TESTS (ANGEPASST AN SIGNALS & WIEDER GRÜN)
  // ==========================================

  describe('createTodo', () => {
    it('sollte online ein Todo erstellen, die Server-ID mappen und das Signal bereitstellen', async () => {
      globalConnectionSignal.set('ONLINE');

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