import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminProjectBoardComponent } from './admin-project-board-component';

describe('AdminProjectBoardComponent', () => {
  let component: AdminProjectBoardComponent;
  let fixture: ComponentFixture<AdminProjectBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProjectBoardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminProjectBoardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
