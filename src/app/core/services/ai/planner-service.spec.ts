import { TestBed } from '@angular/core/testing';
import { PlannerService } from './planner-service';
import { UserService } from '../user/user-service';
import { AiRepository } from '../../repositories/ai-repository';
import { ConnectionService } from '../connection/connection-service';
import { PlannerDataManagerService } from './planner-data-manager-service';
import { Todo } from '../../models/todo';
import { RecommendationResult } from '../../models/recommendation-result';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';

describe('PlannerService (Vitest - Strictly Typed)', () => {
  let service: PlannerService;
  let mockUserService: Partial< UserService >;
  let mockAiRepository: Partial< AiRepository >;
  let mockConnectionService: Partial< ConnectionService >;
  let mockPlannerDataManager: Partial< PlannerDataManagerService >;

  const rawServerTodo = {
    id: 'todo-123',
    task: 'Räume deinen Schreibtisch auf',
    category: 'Arbeit',
    done: false,
    projectId: 'project-1',
    userId: 'user-999'
  };

  beforeEach(() => {
    mockUserService = {
      getCurrentUserId: vi.fn().mockReturnValue('user-999')
    };

    mockConnectionService = {
      isOffline: signal< boolean >(false),
      isOnline: signal< boolean >(true)
    };

    mockAiRepository = {
      getPlannerRecommendation: vi.fn().mockReturnValue(of({
        roundId: 'round-abc',
        recommendations: [
          {
            todo: rawServerTodo,
            plannerDetails: [],
            modeCode: 'STANDARD'
          }
        ]
      }))
    };

    mockPlannerDataManager = {
      queueFeedback: vi.fn(),
      queueSnooze: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        PlannerService,
        { provide: UserService, useValue: mockUserService },
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: AiRepository, useValue: mockAiRepository },
        { provide: PlannerDataManagerService, useValue: mockPlannerDataManager }
      ]
    });

    service = TestBed.inject(PlannerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('loadSmartRecommendation', () => {
    it('sollte die Empfehlungen laden und das Signal befüllen', () => {
      service.loadSmartRecommendation('HIGH', 4);

      expect(mockAiRepository.getPlannerRecommendation).toHaveBeenCalledWith({
        userId: 'user-999',
        userEnergy: 'HIGH',
        workingTimeLeft: 4
      });

      expect(service.activeRoundId()).toBe('round-abc');
      expect(service.recommendations().length).toBe(1);
      expect(service.recommendations()[0].todo.task).toBe('Räume deinen Schreibtisch auf');
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('sendFeedback', () => {
    it('sollte Snooze-Aktionen in die Queue stellen und Runden-Feedback absenden', () => {
      service.activeRoundId.set('round-abc');

      const feedback: RecommendationResult = {
        selectedTodoId: 'todo-999',
        rejections: [
          { todoId: 'todo-123', reason: 'snooze' },
          { todoId: 'todo-456', reason: 'too_heavy' }
        ]
      };

      service.sendFeedback(feedback);

      // Verify queueSnooze was called
      expect(mockPlannerDataManager.queueSnooze).toHaveBeenCalledWith('todo-123', 30);

      // Verify Feedback Payload in Queue
      expect(mockPlannerDataManager.queueFeedback).toHaveBeenCalledWith(
        'user-999',
        'round-abc',
        'todo-999',
        [{ todoId: 'todo-456', rejectReason: 'too_heavy' }]
      );

      // Verification of cleared state (Zero Latency)
      expect(service.recommendations()).toEqual([]);
      expect(service.activeRoundId()).toBeNull();
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('snoozyrecommendedTodo', () => {
    it('sollte das Snoozing in die Queue einreihen und lokal aus dem Signal entfernen', () => {
      const todo1 = new Todo({ task: 'Task 1', id: 'todo-1' });
      const todo2 = new Todo({ task: 'Task 2', id: 'todo-2' });

      service.recommendations.set([
        { todo: todo1, plannerDetails: [], modeCode: 'STANDARD' },
        { todo: todo2, plannerDetails: [], modeCode: 'STANDARD' }
      ]);

      // Aufruf ist void, kein .subscribe()
      service.snoozyrecommendedTodo('todo-1', 15);

      expect(mockPlannerDataManager.queueSnooze).toHaveBeenCalledWith('todo-1', 15);
      expect(service.recommendations().length).toBe(1);
      expect(service.recommendations()[0].todo.id).toBe('todo-2');
    });
  });
});