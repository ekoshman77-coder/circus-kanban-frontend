import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftBadgeComponent } from './draft-badge-component';

describe('DraftBadgeComponent', () => {
  let component: DraftBadgeComponent;
  let fixture: ComponentFixture<DraftBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftBadgeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DraftBadgeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
