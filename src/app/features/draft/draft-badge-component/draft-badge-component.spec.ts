import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftBadgeComponent } from './draft-badge-component';
import { signal } from '@angular/core';
import { DraftUIService } from '../draft-ui-service';

describe('DraftBadgeComponent', () => {
  let component: DraftBadgeComponent;
  let fixture: ComponentFixture<DraftBadgeComponent>;

  const mockDraftUIService = {
    chainsCount: signal(0),
    openDraftBox: vi.fn(),
    showDraftHandle: signal(false)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftBadgeComponent],
      providers: [
        { provide: DraftUIService, useValue: mockDraftUIService }
      ]
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
