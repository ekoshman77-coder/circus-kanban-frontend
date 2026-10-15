import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminTodoBoardComponent } from './admin-todo-board-component';

describe('AdminTodoBoardComponent', () => {
  let component: AdminTodoBoardComponent;
  let fixture: ComponentFixture<AdminTodoBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTodoBoardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminTodoBoardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
