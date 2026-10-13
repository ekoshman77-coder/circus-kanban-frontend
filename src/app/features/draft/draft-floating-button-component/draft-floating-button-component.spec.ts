import { DraftFloatingButtonComponent } from './draft-floating-button-component';
import { DraftUIService } from '../draft-ui-service';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

describe('DraftFloatingButtonComponent', () => {
  let component: DraftFloatingButtonComponent;
  let fixture: ComponentFixture<DraftFloatingButtonComponent>;

  const mockDraftUIService = {
    chainsCount: signal(0),
    openDraftBox: vi.fn(),
    showDraftHandle: signal(false)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftFloatingButtonComponent],
      providers: [
        { provide: DraftUIService, useValue: mockDraftUIService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DraftFloatingButtonComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});