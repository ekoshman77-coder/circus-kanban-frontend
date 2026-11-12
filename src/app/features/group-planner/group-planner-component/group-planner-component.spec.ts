import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupPlannerModalComponent } from './group-planner-component';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { TodoService } from '../../../core/services/todo/todo-service';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';

describe('GroupPlannerComponent', () => {
  let component: GroupPlannerModalComponent;
  let fixture: ComponentFixture<GroupPlannerModalComponent>;
  let mockPlannerService: any;
  let mockTodoService: any;

  beforeEach(async () => {
    // 💡 1. Mocks für die benötigten Services erstellen
    mockPlannerService = {
      closePlannerModal: vi.fn(),
      showPlannerModal: vi.fn(),
      currentPlannerGroup: signal(""),
      loadRecommendationsByGroup: vi.fn().mockReturnValue({ subscribe: vi.fn() })
    };

    mockTodoService = {
      getTodoById: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [GroupPlannerModalComponent],
      providers: [
        // 💡 2. Echte Services durch unsere Mocks ersetzen
        { provide: PlannerService, useValue: mockPlannerService },
        { provide: TodoService, useValue: mockTodoService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupPlannerModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});