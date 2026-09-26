import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftBoxComponent } from './draft-box-component';

describe('DraftBoxComponent', () => {
  let component: DraftBoxComponent;
  let fixture: ComponentFixture<DraftBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftBoxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DraftBoxComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
