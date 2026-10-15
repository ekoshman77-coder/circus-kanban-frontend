import { DraftBoxComponent } from './draft-box-component';
import { DraftUIService } from '../draft-ui-service';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppStateService } from '../../../core/services/app-state/app-state-service';

describe('DraftBoxComponent', () => {
  let component: DraftBoxComponent;
  let fixture: ComponentFixture<DraftBoxComponent>;

  // 🟢 Ein schlanker Mock für den DraftUIService
  const mockDraftUIService = {
    chainsCount: signal(0),
    activeFilter: signal('ALL'),
    localCount: signal(0),
    remoteCount: signal(0),
    filteredChains: signal([]),
    availableUsers: signal([]),
    userContext: signal({ departmentId: 'dep-1', projects: [] }),
    setFavoriteUser: vi.fn(),
    delegateChain: vi.fn(),
    retryChain: vi.fn(),
    openEditModal: vi.fn(),
    discardChain: vi.fn(),
    closeDraftBox: vi.fn(),
    isLaborMode: signal(false)
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DraftBoxComponent],
      providers: [
        // 🟢 Wir ersetzen den echten DraftUIService vollständig durch unseren Mock
        { provide: DraftUIService, useValue: mockDraftUIService }
      ]
    })

    fixture = TestBed.createComponent(DraftBoxComponent);
    component = fixture.componentInstance;
    fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});