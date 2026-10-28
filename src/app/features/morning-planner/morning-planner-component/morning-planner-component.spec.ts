import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MorningPlannerComponent } from './morning-planner-component';

describe('MorningPlannerComponent', () => {
  let component: MorningPlannerComponent;
  let fixture: ComponentFixture<MorningPlannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MorningPlannerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MorningPlannerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
