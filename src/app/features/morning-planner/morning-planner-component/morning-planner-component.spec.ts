import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MorningPlannerComponent } from './morning-planner-component';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { signal } from '@angular/core';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { of } from 'rxjs';

describe('MorningPlannerComponent', () => {
  let component: MorningPlannerComponent;
  let fixture: ComponentFixture<MorningPlannerComponent>;
  let mockPlannerService: any;

  beforeEach(async () => {
    // 💡 1. Wir bauen einen sauberen Mock für den PlannerService
    mockPlannerService = {
      showMorningModal: signal(false), // Das Signal, das die Komponente per computed abfragt
      loadMorningRecommendation: vi.fn().mockReturnValue(of({
        roundId: 'round-123',
        recommendations: [],
      })),
      dismissMorningModal: vi.fn(),
      sendFeedback: vi.fn(),
      snoozyrecommendedTodo: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [MorningPlannerComponent],
      providers: [
        // 💡 2. Echten Service durch unseren Mock ersetzen
        { provide: PlannerService, useValue: mockPlannerService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MorningPlannerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sollte beim Laden die Empfehlung holen, wenn das Modal aktiv ist', () => {
    // Wenn das Signal auf true springt...
    mockPlannerService.showMorningModal.set(true);
    
    // Komponente triggert ngOnInit / Effekte neu
    fixture.detectChanges();

    expect(mockPlannerService.loadMorningRecommendation).toHaveBeenCalled();
  });
});