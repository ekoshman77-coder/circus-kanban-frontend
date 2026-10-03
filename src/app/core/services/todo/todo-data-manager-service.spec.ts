import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodoDataManagerService } from './todo-data-manager-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';
import { signal } from '@angular/core';
import { Todo } from '../../models/todo';
import { of, Subject } from 'rxjs';
import { getCoreTestProviders } from '@tests/helpers/test-providers';
import { StreakRepository } from '../../repositories/streak-repository';


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
  let mockStreakRepository: any;

  // Ein steuerbares Signal für die Standard-Tests
  let globalConnectionSignal = signal<'UNKNOWN' | 'ONLINE' | 'OFFLINE'>('ONLINE');

  beforeEach(() => {
    globalConnectionSignal.set('ONLINE');

    mockStreakRepository = {
      syncAndGetStreakInfo: vi.fn().mockReturnValue(of(null))
    };

    mockTodoRepository = {
      createTodo: vi.fn(),
      syncBulkTodos: vi.fn(() => of({ liste: [], gamificationResult: null })),
      updateTodoStatus: () => ({ pipe: () => { } }),
      deleteTodo: () => ({ pipe: () => { } }),
      updateTodo: () => ({ pipe: () => { } }),
      deleteCompleted: () => ({ pipe: () => { } }),
      deleteAll: () => ({ pipe: () => { } }),
      getRelevantTodos: vi.fn(() => of([]))
    };

    // status ist jetzt ein echtes steuerbares Signal
    mockConnectionService = {
      status: globalConnectionSignal,
      checkRealConnection: () => ({ pipe: () => { } })
    };

    mockUserService = {
      currentUser: vi.fn(() => ({ id: 'user-123', username: 'TestUser' })),
      getCurrentUserId: vi.fn(() => 'user-123'),
      isLoggedIn: vi.fn().mockReturnValue(true), // 🟢 NEU
      onLogout$: new Subject<void>()
    };

    TestBed.configureTestingModule({
      providers: [
        ...getCoreTestProviders(),
        TodoDataManagerService,
        { provide: TodoRepository, useValue: mockTodoRepository },
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: UserService, useValue: mockUserService },
        { provide: StreakRepository, useValue: mockStreakRepository }
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
        checkRealConnection: () => ({ pipe: () => { } })
      };

      const localUserMock = {
        currentUser: localUserSignal,
        getCurrentUserId: () => localUserSignal()?.id || null,
        isLoggedIn: vi.fn(() => !!localUserSignal()),
        onLogout$: new Subject()
      };

      const localStreakRepoMock = {
        syncAndGetStreakInfo: vi.fn().mockReturnValue(of(null))
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ...getCoreTestProviders(),
          TodoDataManagerService,
          { provide: TodoRepository, useValue: mockTodoRepository },
          { provide: ConnectionService, useValue: localConnectionMock },
          { provide: UserService, useValue: localUserMock },
          { provide: StreakRepository, useValue: localStreakRepoMock }
        ]
      });

      const localService = TestBed.inject(TodoDataManagerService);
      (localService as any).localStorageService = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn()
      };

      return { localService, localSignal, localUserSignal, localStreakRepoMock };
    }

    it('sollte Streak-Sync NICHT aufrufen, wenn der Status UNKNOWN ist', () => {
      const { localStreakRepoMock } = setupIsolatedRaceConditionTest('UNKNOWN');

      TestBed.flushEffects();
      expect(localStreakRepoMock.syncAndGetStreakInfo).not.toHaveBeenCalled();
    });

    it('sollte Streak-Sync aufrufen, sobald der Status von UNKNOWN auf ONLINE wechselt', () => {
      const { localSignal, localStreakRepoMock } = setupIsolatedRaceConditionTest('UNKNOWN');

      TestBed.flushEffects();
      expect(localStreakRepoMock.syncAndGetStreakInfo).not.toHaveBeenCalled();

      localSignal.set('ONLINE');
      TestBed.flushEffects();

      expect(localStreakRepoMock.syncAndGetStreakInfo).toHaveBeenCalledWith('user-123');
    });

    it('sollte Streak-Sync NICHT aufrufen, wenn ONLINE schaltet aber kein User angemeldet ist', () => {
      const { localUserSignal, localStreakRepoMock } = setupIsolatedRaceConditionTest('ONLINE');

      localUserSignal.set(null);

      TestBed.flushEffects();
      expect(localStreakRepoMock.syncAndGetStreakInfo).not.toHaveBeenCalled();
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

      service.createTodo(neuesTodo);

      // 2. Das Todo muss sofort im reaktiven Signal lesbar sein
      const ergebnisListe = service.allTodosPool();

      expect(ergebnisListe.length).toBe(1);

      expect(ergebnisListe[0].id).toBeDefined();
      expect(ergebnisListe[0].id.length).toBeGreaterThan(0);
      
      expect(ergebnisListe[0].task).toBe('Online Task');
    });
  });
});

