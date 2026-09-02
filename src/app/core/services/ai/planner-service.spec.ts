import { TestBed } from '@angular/core/testing';
import { PlannerService } from './planner-service';
import { UserService } from '../user/user-service';
import { AiRepository } from '../../repositories/ai-repository';
import { Todo } from '../../models/todo';
import { RecommendationResult } from '../../models/recommendation-result';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';

describe('PlannerService (Vitest - Strictly Typed)', () => {
  let service: PlannerService;
  let mockUserService: Partial<UserService>;
  let mockAiRepository: Partial<AiRepository>;

  const rawServerTodo = {
    id: 'todo-123',
    task: 'Räume deinen Schreibtisch auf',
    category: 'Arbeit',
    done: false,
    projectId: 'project-1',
    userId: 'user-999'
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockUserService = {
      getCurrentUserId: vi.fn().mockReturnValue('user-999')
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
      })),
      sendPlannerFeedback: vi.fn().mockReturnValue(of(null)),
      snoozyTodo: vi.fn().mockReturnValue(of(undefined))
    };

    TestBed.configureTestingModule({
      providers: [
        PlannerService,
        { provide: UserService, useValue: mockUserService },
        { provide: AiRepository, useValue: mockAiRepository }
      ]
    });

    service = TestBed.inject(PlannerService);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    it('sollte Snooze-Aktionen sofort ausführen und danach Runden-Feedback absenden', async () => {
      service.activeRoundId.set('round-abc');

      const feedback: RecommendationResult = {
        selectedTodoId: 'todo-999',
        rejections: [
          { todoId: 'todo-123', reason: 'snooze' },
          { todoId: 'todo-456', reason: 'too_heavy' }
        ]
      };

      // Aufruf ist void
      service.sendFeedback(feedback);

      // Verify immediate Snooze
      expect(mockAiRepository.snoozyTodo).toHaveBeenCalledWith('todo-123', 30);

      // Virtuelle Zeit vorspulen (delay(800) im Service)
      await vi.advanceTimersByTimeAsync(800);

      // Verify Feedback Payload
      expect(mockAiRepository.sendPlannerFeedback).toHaveBeenCalledWith({
        userId: 'user-999',
        roundId: 'round-abc',
        acceptedTodoId: 'todo-999',
        rejectedTodos: [
          { todoId: 'todo-456', rejectReason: 'too_heavy' }
        ]
      });

      // Verification of cleared state
      expect(service.recommendations()).toEqual([]);
      expect(service.activeRoundId()).toBeNull();
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('snoozyrecommendedTodo', () => {
    it('sollte das Snoozing an das Repository melden und lokal aus dem Signal entfernen', () => {
      const todo1 = new Todo({ task: 'Task 1', id: 'todo-1' });
      const todo2 = new Todo({ task: 'Task 2', id: 'todo-2' });

      service.recommendations.set([
        { todo: todo1, plannerDetails: [], modeCode: 'STANDARD' },
        { todo: todo2, plannerDetails: [], modeCode: 'STANDARD' }
      ]);

      service.snoozyrecommendedTodo('todo-1', 15).subscribe();

      expect(mockAiRepository.snoozyTodo).toHaveBeenCalledWith('todo-1', 15);
      expect(service.recommendations().length).toBe(1);
      expect(service.recommendations()[0].todo.id).toBe('todo-2');
    });
  });
});