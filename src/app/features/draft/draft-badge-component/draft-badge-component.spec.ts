import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftBadgeComponent } from './draft-badge-component';
import { signal } from '@angular/core';
import { DraftUIService } from '../draft-ui-service';
import { LocalStorageService } from '../../../core/services/user/local-storage-service';
import { mockLocalStorageService } from '@tests/helpers/test-providers';
import { AppStateService } from '../../../core/services/app-state/app-state-service';

describe('DraftBadgeComponent', () => {
  let component: DraftBadgeComponent;
  let fixture: ComponentFixture<DraftBadgeComponent>;

  const mockDraftUIService = {
    chainsCount: signal(0),
    openDraftBox: vi.fn(),
    showDraftHandle: signal(false)
  };

  const mockAppStateService = {
    isLaborMode: signal(false)
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftBadgeComponent],
      providers: [
        { provide: AppStateService, useValue: mockAppStateService},
        { provide: DraftUIService, useValue: mockDraftUIService },
        { provide: LocalStorageService, useValue: mockLocalStorageService}
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
