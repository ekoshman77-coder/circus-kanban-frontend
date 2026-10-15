import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LaborSwitchComponent } from './labor-switch-component';
import { signal } from '@angular/core';
import { AppStateService } from '../../../core/services/app-state/app-state-service';

describe('LaborSwitchComponent', () => {
  let component: LaborSwitchComponent;
  let fixture: ComponentFixture<LaborSwitchComponent>;

  const mockAppStateService = {
    isLaborMode: signal(false),
    isLaborForced: signal(false),
    toggleLaborMode: vi.fn()
  };
  
  beforeEach(() => {
    mockAppStateService.toggleLaborMode.mockReset();

    TestBed.configureTestingModule({
      imports: [LaborSwitchComponent],
      providers: [
        { provide: AppStateService, useValue: mockAppStateService }
      ]
    });

    fixture = TestBed.createComponent(LaborSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sollte erstellt werden', () => {
    expect(component).toBeTruthy();
  });
  
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
