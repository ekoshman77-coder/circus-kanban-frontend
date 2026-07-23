import { TestBed } from '@angular/core/testing';
import { PlannerService } from './planner-service';
import { UserService } from '../user/user-service';
import { AiRepository } from '../../repositories/ai-repository';
import { Todo } from '../../models/todo';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

describe('PlannerService', () => {
  let service: PlannerService;
  let mockUserService: any;
  let mockAiRepository: any;

  const rawServerTodo = {
    id: 'todo-123',
    task: 'Räume deinen Schreibtisch auf',
    category: 'Arbeit',
    done: false,
    projectId: 'project-1',
    userId: 'user-999'
  };

  beforeEach(() => {
    // 1. Uhren und Mocks vor JEDEM Test komplett auf Null setzen
    vi.useFakeTimers();
    vi.resetAllMocks();

    mockUserService = {
      getCurrentUserId: vi.fn().mockReturnValue('user-999')
    };

    mockAiRepository = {
      getPlannerRecommendation: vi.fn().mockReturnValue(of({
        todo: rawServerTodo,
        modeCode: 'STANDARD',
        reasonCode: 'DEFAULT'
      })),
      sendPlannerFeedback: vi.fn().mockReturnValue(of(null)),
      snoozyTodo: vi.fn().mockReturnValue(of(null))
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
    // 2. Nach jedem Test aufräumen, damit parallele Worker sich nicht beißen
    vi.useRealTimers();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('sendFeedback', () => {
    it('sollte Feedback an das Repository schicken', () => {
      // Stream abonnieren, damit er ausgeführt wird
      service.sendFeedback('todo-123', false, 'too_heavy', 'normal').subscribe();

      expect(mockAiRepository.sendPlannerFeedback).toHaveBeenCalledWith({
        userId: 'user-999',
        todoId: 'todo-123',
        accepted: false,
        rejectReason: 'too_heavy',
        currentEnergy: 'normal'
      });
    });

    it('sollte bei Akzeptanz der Aufgabe die Empfehlungs-Signals leeren', async () => {
      const initialTodo = new Todo(rawServerTodo);
      service.recommendedTodo.set(initialTodo);
      service.aiResponseCode.set({ todo: initialTodo, modeCode: 'STANDARD', reasonCode: 'DEFAULT' });

      service.sendFeedback('todo-123', true, null, 'high').subscribe();

      // Wartet exakt das delay(800) in der virtuellen Zeit ab
      await vi.advanceTimersByTimeAsync(800);

      expect(service.recommendedTodo()).toBeNull();
      expect(service.aiResponseCode()).toBeNull();
    });

    it('sollte bei Ablehnung der Aufgabe die Empfehlungs-Signals NICHT leeren', async () => {
      const initialTodo = new Todo(rawServerTodo);
      service.recommendedTodo.set(initialTodo);

      service.sendFeedback('todo-123', false, 'no_motivation', 'low').subscribe();

      await vi.advanceTimersByTimeAsync(800);

      expect(service.recommendedTodo()).toEqual(initialTodo);
    });

    describe('snoozyrecommendedTodo', () => {
      it('sollte das Snoozing an das Repository melden', () => {
        service.snoozyrecommendedTodo('todo-123', 15).subscribe();

        expect(mockAiRepository.snoozyTodo).toHaveBeenCalledWith('todo-123', 15);
      });

      it('sollte das recommendedTodo-Signal nach erfolgreichem Snoozing leeren', () => {
        // Setup: Signal hat einen Wert
        const initialTodo = new Todo(rawServerTodo);
        service.recommendedTodo.set(initialTodo);

        // Aktion: Snooze aufrufen und abonnieren
        service.snoozyrecommendedTodo('todo-123', 15).subscribe();

        // Assert: Signal muss danach null sein
        expect(service.recommendedTodo()).toBeNull();
      });
    });
  });

});