import { TestBed } from '@angular/core/testing';
import { PlannerService } from './planner-service';
import { UserService } from '../user/user-service';
import { AiRepository } from '../../repositories/ai-repository';
import { ConnectionService } from '../connection/connection-service';
import { PlannerDataManagerService } from './planner-data-manager-service';
import { TodoService } from '../todo/todo-service';
import { Todo } from '../../models/todo';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { RejectAction } from '../../models/recommendation-actions';

describe('PlannerService (Vitest - Strictly Typed)', () => {
  let service: PlannerService;
  let mockUserService: Partial<UserService>;
  let mockAiRepository: Partial<AiRepository>;
  let mockConnectionService: Partial<ConnectionService>;
  let mockPlannerDataManager: Partial<PlannerDataManagerService>;
  let mockTodoService: Partial<TodoService>;

  const sampleTodo = new Todo({
    id: 'todo-123',
    task: 'Räume deinen Schreibtisch auf',
    category: 'Arbeit',
    done: false,
    userId: 'user-999'
  });

  beforeEach(() => {
    mockUserService = {
      getCurrentUserId: vi.fn().mockReturnValue('user-999')
    };

    mockConnectionService = {
      isOffline: signal<boolean>(false),
      isOnline: signal<boolean>(true)
    };

    mockTodoService = {
      allTodos: signal<Todo[]>([sampleTodo])
    };

    mockAiRepository = {
      getPlannerRecommendation: vi.fn().mockReturnValue(of({
        roundId: 'round-abc',
        userId: 'user-999',
        recommendations: [
          {
            todoId: 'todo-123',
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
        { provide: PlannerDataManagerService, useValue: mockPlannerDataManager },
        { provide: TodoService, useValue: mockTodoService }
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
    it('sollte die Empfehlungen vom Repository laden und mappen', (done) => {
      service.loadSmartRecommendation('HIGH', 4).subscribe(vm => {
        expect(mockAiRepository.getPlannerRecommendation).toHaveBeenCalledWith({
          userId: 'user-999',
          userEnergy: 'HIGH',
          workingTimeLeft: 4
        });

        expect(vm).not.toBeNull();
        expect(vm?.roundId).toBe('round-abc');
        expect(vm?.recommendations.length).toBe(1);
        expect(vm?.recommendations[0].todo.task).toBe('Räume deinen Schreibtisch auf');
        expect(service.isLoading()).toBe(false);
        
      });
    });
  });

  describe('Feedback and Snooze Actions', () => {
    it('sollte akzeptierte Empfehlungen an den DataManager übergeben', () => {
      const action = { roundId: 'round-abc', todoId: 'todo-123' };
      service.acceptRecommendation(action);

      expect(mockPlannerDataManager.queueFeedback).toHaveBeenCalledWith(
        'user-999',
        action,
        []
      );
    });

    it('sollte abgelehnte Empfehlungen an den DataManager übergeben', () => {
      const action: RejectAction = { roundId: 'round-abc', todoId: 'todo-123', reason: 'too_heavy' };
      service.rejectRecommendation(action);

      expect(mockPlannerDataManager.queueFeedback).toHaveBeenCalledWith(
        'user-999',
        null,
        [action]
      );
    });

    it('sollte Snooze-Aktionen in die Queue einreihen', () => {
      const snoozeAction = { todoId: 'todo-123', durationInMin: 30 };
      service.snoozeRecommendation(snoozeAction);

      expect(mockPlannerDataManager.queueSnooze).toHaveBeenCalledWith('todo-123', 30);
    });
  });
});