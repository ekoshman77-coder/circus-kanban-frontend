import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MilestoneSuggestionsComponent } from './milestone-suggestions-component';

describe('MilestoneSuggestionsComponent', () => {
  let component: MilestoneSuggestionsComponent;
  let fixture: ComponentFixture<MilestoneSuggestionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MilestoneSuggestionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MilestoneSuggestionsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
