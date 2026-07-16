import { TestBed } from '@angular/core/testing';
import { PlannerService } from './planner-service';
import { UserService } from '../user/user-service';
import { AiRepository } from '../../repositories/ai-repository';
import { Todo } from '../../models/todo';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

describe('PlannerService', () => {
  let service: PlannerService;
  
  // Mocks für die Services
  let mockUserService: any;
  let mockAiRepository: any;

  // Beispiel-Rohdaten vom Server (entspricht dem JSON-Format vor dem Mapping)
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

    mockAiRepository = {
      getPlannerRecommendation: vi.fn().mockReturnValue(of({
        todo: rawServerTodo,
        modeCode: 'STANDARD',
        reasonCode: 'DEFAULT'
      })),
      sendPlannerFeedback: vi.fn().mockReturnValue(of(null))
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

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('loadSmartRecommendation', () => {
    it('sollte den Ladeindikator umschalten und Daten korrekt in ein Todo-Modell mappen', () => {
      service.loadSmartRecommendation('normal', 6);

      // isLoading sollte nach dem erfolgreichen Request wieder false sein
      expect(service.isLoading()).toBe(false);
      
      // recommendedTodo sollte mit einer echten Todo-Instanz befüllt sein
      const recommended = service.recommendedTodo();
      expect(recommended).toBeTruthy();
      expect(recommended).toBeInstanceOf(Todo); // Prüft, ob es ein echtes Todo-Objekt ist!
      expect(recommended?.id).toBe('todo-123');
      expect(recommended?.task).toBe('Räume deinen Schreibtisch auf');

      // aiResponseCode sollte alle Metadaten enthalten
      const responseCode = service.aiResponseCode();
      expect(responseCode?.modeCode).toBe('STANDARD');
      expect(responseCode?.reasonCode).toBe('DEFAULT');

      // Prüfen, ob das Repository mit den richtigen Parametern gerufen wurde
      expect(mockAiRepository.getPlannerRecommendation).toHaveBeenCalledWith({
        userId: 'user-999',
        userEnergy: 'normal',
        workingTimeLeft: 6
      });
    });

    it('sollte isLoading auf false setzen, wenn der API-Aufruf fehlschlägt', () => {
      mockAiRepository.getPlannerRecommendation.mockReturnValue(throwError(() => new Error('API down')));
      
      service.loadSmartRecommendation('high', 8);
      
      expect(service.isLoading()).toBe(false);
      expect(service.recommendedTodo()).toBeNull();
    });
  });

  describe('sendFeedback', () => {
    it('sollte Feedback an das Repository schicken', () => {
      service.sendFeedback('todo-123', false, 'too_heavy', 'normal');

      expect(mockAiRepository.sendPlannerFeedback).toHaveBeenCalledWith({
        userId: 'user-999',
        todoId: 'todo-123',
        accepted: false,
        rejectReason: 'too_heavy',
        currentEnergy: 'normal'
      });
    });

    it('sollte bei Akzeptanz der Aufgabe die Empfehlungs-Signals leeren', () => {
      // Wir erstellen eine echte Instanz des Todo-Modells für den Testzustand
      const initialTodo = new Todo(rawServerTodo);
      service.recommendedTodo.set(initialTodo);
      service.aiResponseCode.set({ todo: initialTodo, modeCode: 'STANDARD', reasonCode: 'DEFAULT' });

      // Nutzer akzeptiert den Vorschlag (accepted = true)
      service.sendFeedback('todo-123', true, null, 'high');

      // Signals müssen jetzt geleert (null) sein
      expect(service.recommendedTodo()).toBeNull();
      expect(service.aiResponseCode()).toBeNull();
    });

    it('sollte bei Ablehnung der Aufgabe die Empfehlungs-Signals NICHT leeren', () => {
      const initialTodo = new Todo(rawServerTodo);
      service.recommendedTodo.set(initialTodo);

      // Nutzer lehnt ab (accepted = false)
      service.sendFeedback('todo-123', false, 'no_motivation', 'low');

      // Das Signal darf sich nicht verändert haben
      expect(service.recommendedTodo()).toEqual(initialTodo);
    });
  });
});