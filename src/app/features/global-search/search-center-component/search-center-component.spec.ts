import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchCenterComponent } from './search-center-component';

describe('SearchCenterComponent', () => {
  let component: SearchCenterComponent;
  let fixture: ComponentFixture<SearchCenterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchCenterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchCenterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
