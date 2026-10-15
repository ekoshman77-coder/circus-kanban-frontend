import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterComponent } from './filter-component';

describe('FilterComponent', () => {
  let component: FilterComponent;
  let fixture: ComponentFixture<FilterComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FilterComponent]
    })
    
    fixture = TestBed.createComponent(FilterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
