import { TestBed } from '@angular/core/testing';
import { FocusDataManagerService } from './focus-data-manager-service';
import { ConnectionService } from '../connection/connection-service';
import { GamificationRepository } from '../../repositories/gamification-repsoitory';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { CentralQueueService } from '../central-queue/central-queue-service';
import { QueueItem } from '../../models/queue-items/queue-item';
import { FocusPomodoroPayload } from '../../models/queue-items/pomodoro-payload';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { Todo } from '../../models/todo';

describe('FocusDataManagerService', () => {
  let service: FocusDataManagerService;

  // Typsichere Mocks
  let mockConnectionService: Partial<ConnectionService>;
  let mockGamificationRepository: Partial<GamificationRepository>;
  let mockUserService: Partial<UserService>;
  let mockLoggerService: Partial<LoggerService>;
  let mockQueueService: Partial<CentralQueueService>;

  const TEST_USER_ID = 'user-777';

  beforeEach(() => {
    mockConnectionService = {
      isOffline: signal<boolean>(false),
      isOnline: signal<boolean>(true)
    };

    mockGamificationRepository = {
      sendPomodoroSession: vi.fn().mockReturnValue(of({ xp: 100, level: 2 }))
    };

    mockUserService = {
      currentUser: signal({ id: TEST_USER_ID, username: 'TestUser' } as any),
      getCurrentUserId: vi.fn().mockReturnValue(TEST_USER_ID),
      updateGamification: vi.fn()
    };

    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockQueueService = {
      enqueue: vi.fn(),
      registerService: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        FocusDataManagerService,
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: GamificationRepository, useValue: mockGamificationRepository },
        { provide: UserService, useValue: mockUserService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: CentralQueueService, useValue: mockQueueService }
      ]
    });

    service = TestBed.inject(FocusDataManagerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('recordCompletedPomodoro (Sitzung aufzeichnen)', () => {
    it('sollte eine RECORD_POMODORO Action in die Queue reihen', () => {
      const mockTodo = new Todo({ id: 'todo-abc', task: 'Mein Todo' });

      service.recordCompletedPomodoro(mockTodo);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.FOCUS,
        'RECORD_POMODORO',
        expect.objectContaining({
          userId: TEST_USER_ID,
          todoId: 'todo-abc',
          count: 1,
          displayInfo: {
            category: 'Fokus-Session',
            title: 'Pomodoro: "Mein Todo"'
          }
        })
      );
      expect(mockLoggerService.info).toHaveBeenCalledWith('FocusDataManager', 'Pomodoro in die globale Queue eingereiht.');
    });

    it('sollte abbrechen, wenn kein User eingeloggt ist', () => {
      vi.mocked(mockUserService.getCurrentUserId!).mockReturnValue(null);
      const mockTodo = new Todo({ id: 'todo-xyz', task: 'Test Task' });

      service.recordCompletedPomodoro(mockTodo);

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('executeQueueItem & handleQueueResult (Queue Handler)', () => {
    it('sollte bei executeQueueItem das Backend über das Repository aufrufen', () => {
      const mockPayload: FocusPomodoroPayload = {
        id: 'p-1',
        userId: TEST_USER_ID,
        todoId: 'todo-abc',
        count: 1,
        displayInfo: {
          category: 'Fokus-Session',
          title: 'Pomodoro Test'
        }
      };

      const mockItem: QueueItem<FocusPomodoroPayload> = {
        id: 'q-1',
        serviceName: QueueHandlerName.FOCUS,
        action: 'RECORD_POMODORO',
        payload: mockPayload,
        timestamp: Date.now()
      };

      service.executeQueueItem(mockItem).subscribe((result) => {
        expect(result).toEqual({ xp: 100, level: 2 });
      });

      expect(mockGamificationRepository.sendPomodoroSession).toHaveBeenCalledWith(TEST_USER_ID, {
        todoId: 'todo-abc',
        count: 1
      });
    });

    it('sollte bei erfolgreichem handleQueueResult die Gamification des Users aktualisieren', () => {
      const mockPayload: FocusPomodoroPayload = {
        id: 'p-1',
        userId: TEST_USER_ID,
        todoId: 'todo-abc',
        count: 1,
        displayInfo: {
          category: 'Fokus-Session',
          title: 'Pomodoro Test'
        }
      };

      const mockItem: QueueItem<FocusPomodoroPayload> = {
        id: 'q-1',
        serviceName: QueueHandlerName.FOCUS,
        action: 'RECORD_POMODORO',
        payload: mockPayload,
        timestamp: Date.now()
      };

      const gamificationResult = { xp: 100, level: 2 } as any;

      service.handleQueueResult(mockItem, true, gamificationResult);

      expect(mockUserService.updateGamification).toHaveBeenCalledWith(gamificationResult);
      expect(mockLoggerService.info).toHaveBeenCalledWith('FocusDataManager', 'Pomodoro verbucht. XP & Level im State aktualisiert!');
    });
  });
});