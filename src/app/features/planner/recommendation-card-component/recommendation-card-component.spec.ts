import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationCardComponent } from './recommendation-card-component';
import { signal } from '@angular/core';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { TodoService } from '../../../core/services/todo/todo-service';
import { TeamService } from '../../../core/services/team/team-service';
import { LocalStorageService } from '../../../core/services/user/local-storage-service';
import { mockLocalStorageService, mockUserService } from '@tests/helpers/test-providers';
import { UserService } from '../../../core/services/user/user-service';
import { Todo } from '../../../core/models/todo';

describe('RecommendationCardComponent', () => {
  let component: RecommendationCardComponent;
  let fixture: ComponentFixture<RecommendationCardComponent>;
  let mockPlannerService: any
  let mockTodoService: any
  let mockTeamService: any

  beforeEach(async () => {
    mockPlannerService = {
      showMorningModal: signal(false), // Das Signal, das die Komponente per computed abfragt
      loadMorningRecommendation: vi.fn(),
      dismissMorningModal: vi.fn(),
      sendFeedback: vi.fn(),
      snoozyrecommendedTodo: vi.fn()
    };

    mockTodoService = {
      toggleComplete: vi.fn()
    }

    mockTeamService = {

    }


    await TestBed.configureTestingModule({
      imports: [RecommendationCardComponent],
      providers: [
        {provide: PlannerService, useValue: mockPlannerService},
        {provide: TodoService, useValue: mockTodoService},
        {provide: TeamService, useValue: mockTeamService},
        {provide: LocalStorageService, useValue: mockLocalStorageService},
        {provide: UserService, useValue: mockUserService}
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RecommendationCardComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('roundId', 'round-123');
    fixture.componentRef.setInput('item', {
      todo: new Todo({ id: 'todo-1', task: 'Test Aufgabe', effort: 2 }),
      plannerDetails: [],
      modeCode: 'STANDARD'
    });
    
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
