import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlannerRecommendationComponent } from './planner-recommendation-component';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { Todo } from '../../../core/models/todo';
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TodoItemComponentMock } from '@tests/helpers/todo-item-component-mock';

describe('PlannerRecommendationComponent', () => {
  let component: PlannerRecommendationComponent;
  let fixture: ComponentFixture<PlannerRecommendationComponent>;
  let plannerServiceMock: { sendFeedback: ReturnType<typeof vi.fn> };

  const mockTodoItem = {
    todo: new Todo({ id: 'todo-1', task: 'Test Aufgabe', effort: 3, category: 'Code' }),
    plannerDetails: [],
    modeCode: 'STANDARD' as const
  };
  
  beforeEach(async () => {
    plannerServiceMock = {
      sendFeedback: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [PlannerRecommendationComponent],
      providers: [
        { provide: PlannerService, useValue: plannerServiceMock }
      ]
    })
    .overrideComponent(PlannerRecommendationComponent, {
      set: {
        imports: [CommonModule, TodoItemComponentMock]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlannerRecommendationComponent);
    component = fixture.componentInstance;
    
    // Input-Signal setzen
    fixture.componentRef.setInput('recommendations', [mockTodoItem]);
    fixture.detectChanges();
  });

  it('sollte beim Annehmen (egal welcher Chip) die Session beenden und das Todo emittieren', () => {
    const emitSpy = vi.fn();
    component.sessionCompleted.subscribe(emitSpy);

    component.onSelect(mockTodoItem, 'motivation');

    expect(plannerServiceMock.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTodoId: 'todo-1'
      })
    );

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTodoId: 'todo-1'
      })
    );
  });

  it('sollte auch bei "Passt gerade" (null als Zone) die Session korrekt beenden', () => {
    const emitSpy = vi.fn();
    component.sessionCompleted.subscribe(emitSpy);

    component.onSelect(mockTodoItem, null);

    expect(plannerServiceMock.sendFeedback).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTodoId: 'todo-1'
      })
    );
  });

  it('sollte Ablehnungen im Puffer sammeln und erst bei der letzten Ablehnung die Session beenden', () => {
    const emitSpy = vi.fn();
    component.sessionCompleted.subscribe(emitSpy);

    component.onReject('todo-1', 'too_heavy');

    expect(plannerServiceMock.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTodoId: undefined,
        rejections: [{ todoId: 'todo-1', reason: 'too_heavy' }]
      })
    );
    expect(emitSpy).toHaveBeenCalled();
  });
});