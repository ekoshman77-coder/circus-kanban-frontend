import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftFloatingButtonComponent } from './draft-floating-button-component';

describe('DraftFloatingButtonComponent', () => {
  let component: DraftFloatingButtonComponent;
  let fixture: ComponentFixture<DraftFloatingButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftFloatingButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DraftFloatingButtonComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
