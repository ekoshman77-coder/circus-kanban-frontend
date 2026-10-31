import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupPlannerComponent } from './group-planner-component';

describe('GroupPlannerComponent', () => {
  let component: GroupPlannerComponent;
  let fixture: ComponentFixture<GroupPlannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupPlannerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupPlannerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
