import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatFilterBarComponent } from './stat-filter-bar-component';

describe('StatFilterBarComponent', () => {
  let component: StatFilterBarComponent;
  let fixture: ComponentFixture<StatFilterBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatFilterBarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatFilterBarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
