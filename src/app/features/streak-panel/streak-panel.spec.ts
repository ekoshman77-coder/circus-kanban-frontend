import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StreakPanelComponent } from './streak-panel';

describe('StreakPanel', () => {
  let component: StreakPanelComponent;
  let fixture: ComponentFixture<StreakPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StreakPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StreakPanelComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
