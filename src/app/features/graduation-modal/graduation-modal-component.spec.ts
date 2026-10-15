import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraduationModalComponent } from './graduation-modal-component';
import { DraftService } from '../../core/services/draft-chains/draft-service';
import { UserStatusPollingService } from '../../core/services/admin/user-status-polling-service';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

describe('GraduationModalComponent', () => {
  let component: GraduationModalComponent;
  let fixture: ComponentFixture<GraduationModalComponent>;

  let mockDraftService: any;
  let mockPollingService: any;

  beforeEach(async () => {
    vi.useFakeTimers();

    mockDraftService = {
      sandboxSummary: signal({
        totalChains: 3,
        notesCount: 1,
        todosCount: 1,
        projectsCount: 1
      }),
      laborDrafts: signal([
        { id: 'draft_1', title: 'Test Entwurf 1', items: [{ queueItem: {} }] },
        { id: 'draft_2', title: 'Test Entwurf 2', items: [{ queueItem: {} }] }
      ]),
      promoteLaborDraftsToRealWorld: vi.fn(),
      resetData: vi.fn()
    };

    mockPollingService = {
      graduationPending: signal({
        user: {
          id: 'test-user-123',
          firstName: 'Alex',
          lastName: 'Muster',
          departmentRole: 'MEMBER',
          isApproved: true
        },
        source: 'LIVE_POLLING'
      }),
      dismissGraduation: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [GraduationModalComponent],
      providers: [
        { provide: DraftService, useValue: mockDraftService },
        { provide: UserStatusPollingService, useValue: mockPollingService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GraduationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sollte im Schritt OVERVIEW initial die Zusammenfassung anzeigen', () => {
    expect(component.currentStep()).toBe('OVERVIEW');

    const counts = fixture.debugElement.queryAll(By.css('.summary-item .count'));
    expect(counts[0].nativeElement.textContent.trim()).toBe('3'); // Total Chains
    expect(counts[1].nativeElement.textContent.trim()).toBe('1'); // Notes
    expect(counts[2].nativeElement.textContent.trim()).toBe('1'); // Todos
    expect(counts[3].nativeElement.textContent.trim()).toBe('1'); // Projects
  });

  it('PFAD 1: sollte bei "In die Realwelt übernehmen" promoteLaborDraftsToRealWorld aufrufen und zu SUCCESS wechseln', () => {
    // 1. Klick auf Button "In die Realwelt übernehmen"
    const promoteBtn = fixture.debugElement.query(By.css('.btn-primary'));
    promoteBtn.nativeElement.click();
    fixture.detectChanges();

    // Schritt wechselt sofort zu PROCESSING
    expect(component.currentStep()).toBe('PROCESSING');

    // Timer simulieren (800ms im Component-Code)
    vi.advanceTimersByTime(800);
    fixture.detectChanges();

    // Methode im Service gerufen & Step ist SUCCESS
    expect(mockDraftService.promoteLaborDraftsToRealWorld).toHaveBeenCalledTimes(1);
    expect(component.currentStep()).toBe('SUCCESS');

    // 2. Klick auf "Super, weiter geht's!" (Modal schließen)
    const closeBtn = fixture.debugElement.query(By.css('.btn-primary'));
    closeBtn.nativeElement.click();

    expect(mockPollingService.dismissGraduation).toHaveBeenCalledTimes(1);
  });

  it('PFAD 2: sollte bei "Als normale Entwürfe behalten" das Modal schließen, ohne Drafts zu verändern', () => {
    const keepBtn = fixture.debugElement.query(By.css('.btn-secondary'));
    keepBtn.nativeElement.click();
    fixture.detectChanges();

    expect(component.currentStep()).toBe('PROCESSING');

    // Timer simulieren (500ms im Component-Code)
    vi.advanceTimersByTime(500);
    fixture.detectChanges();

    expect(mockDraftService.promoteLaborDraftsToRealWorld).not.toHaveBeenCalled();
    expect(mockDraftService.resetData).not.toHaveBeenCalled();
    expect(mockPollingService.dismissGraduation).toHaveBeenCalledTimes(1);
  });

  it('PFAD 3: sollte bei "Sandbox-Daten verwerfen" Bestätigung verlangen und nach Bestätigung resetData rufen', () => {
    // 1. Klick auf "Sandbox-Daten verwerfen"
    const discardLink = fixture.debugElement.query(By.css('.btn-danger-link'));
    discardLink.nativeElement.click();
    fixture.detectChanges();

    // Step wechselt zu CONFIRM_DISCARD
    expect(component.currentStep()).toBe('CONFIRM_DISCARD');

    // 2. Klick auf Bestätigen-Button "Ja, alles unwiderruflich löschen"
    const confirmBtn = fixture.debugElement.query(By.css('.btn-danger'));
    confirmBtn.nativeElement.click();

    expect(mockDraftService.resetData).toHaveBeenCalledTimes(1);
    expect(mockPollingService.dismissGraduation).toHaveBeenCalledTimes(1);
  });
});