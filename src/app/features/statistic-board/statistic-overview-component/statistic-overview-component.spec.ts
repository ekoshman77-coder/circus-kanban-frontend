import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatisticOverviewComponent } from './statistic-overview-component';

describe('StatisticOverviewComponent', () => {
  let component: StatisticOverviewComponent;
  let fixture: ComponentFixture<StatisticOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatisticOverviewComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
