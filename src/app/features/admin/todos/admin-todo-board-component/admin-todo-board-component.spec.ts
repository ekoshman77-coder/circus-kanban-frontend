import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminTodoBoardComponent } from './admin-todo-board-component';
import { AdminTodoService } from '../../../../core/services/admin/todos/admin-todo-service';
import { ConnectionService } from '../../../../core/services/connection/connection-service';
import { AdminTeamService } from '../../../../core/services/admin/admin-team-service';

describe('AdminTodoBoardComponent', () => {
  let component: AdminTodoBoardComponent;
  let fixture: ComponentFixture<AdminTodoBoardComponent>;

  // 1. Mocks mit Vitest (vi.fn()) erstellen
  const adminTodoServiceMock = {
    isLoading: signal(false),
    rawAdminTodos: signal([]),
    departmentOptions: signal([]),
    projectOptions: signal([]),
    userOptions: signal([]),
    activeFilter: signal(null),
    applyFilter: vi.fn(),
  };

  const connectionServiceMock = {
    isOnline: signal(true),
  };

  const adminTeamServiceMock = {
    getUserById: vi.fn().mockReturnValue(null),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTodoBoardComponent],
      providers: [
        { provide: AdminTodoService, useValue: adminTodoServiceMock },
        { provide: ConnectionService, useValue: connectionServiceMock },
        { provide: AdminTeamService, useValue: adminTeamServiceMock },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminTodoBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});