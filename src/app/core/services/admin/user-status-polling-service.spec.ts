import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Subject } from 'rxjs';
import { UserStatusPollingService } from './user-status-polling-service';
import { UserService } from '../user/user-service';
import { DraftQueueDataManager } from '../draft-chains/draft-data-manager';
import { CentralQueueService } from '../central-queue/central-queue-service';
import { UserModel } from '../../models/user-model';

describe('UserStatusPollingService (Vitest)', () => {
  let service: UserStatusPollingService;

  const currentUserSignal = signal<UserModel | null>(null);
  const isLoggedInSignal = signal<boolean>(true);
  let fetchCurrentStatusSubject: Subject<UserModel | null>;

  const mockUserService = {
    currentUser: currentUserSignal,
    isLoggedIn: isLoggedInSignal,
    fetchCurrentStatus: vi.fn()
  };

  const mockDraftDataManager = {
    draftChainsSignal: signal([])
  };

  const mockCentralQueueService = {
    isLaborMode: vi.fn().mockReturnValue(false)
  };

  beforeEach(() => {
    vi.useFakeTimers();
    fetchCurrentStatusSubject = new Subject<UserModel | null>();

    currentUserSignal.set(null);
    isLoggedInSignal.set(true);
    mockUserService.fetchCurrentStatus.mockReset();
    mockUserService.fetchCurrentStatus.mockReturnValue(fetchCurrentStatusSubject.asObservable());
    mockCentralQueueService.isLaborMode.mockReturnValue(false);

    TestBed.configureTestingModule({
      providers: [
        UserStatusPollingService,
        { provide: UserService, useValue: mockUserService },
        { provide: DraftQueueDataManager, useValue: mockDraftDataManager },
        { provide: CentralQueueService, useValue: mockCentralQueueService }
      ]
    });

    service = TestBed.inject(UserStatusPollingService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sollte instanziiert werden', () => {
    expect(service).toBeTruthy();
  });

  // =========================================================================
  // 1. WARTERAUM-POLLING (15 Sekunden)
  // =========================================================================
  it('sollte im Warteraum alle 15 Sekunden statustests durchführen', () => {
    const unapprovedUser = { id: 'user-1', isApproved: false, departmentRole: 'MEMBER' } as UserModel;
    currentUserSignal.set(unapprovedUser);
    
    // ⚡ Effects und Timers spülen
    TestBed.flushEffects();

    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(15000);
    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(15000);
    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(3);
  });

  // =========================================================================
  // 2. LABOR-POLLING (5 Minuten)
  // =========================================================================
  it('sollte bei Praktikanten/Gästen im 5-Minuten-Intervall pollen', () => {
    const internUser = { id: 'user-2', isApproved: true, departmentRole: 'INTERN' } as UserModel;
    currentUserSignal.set(internUser);
    
    // ⚡ Effects und Timers spülen
    TestBed.flushEffects();

    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(15000);
    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300000);
    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(2);
  });

  // =========================================================================
  // 3. GRATULATION-EVENT
  // =========================================================================
  it('sollte graduationPending auslösen, wenn der Server eine Live-Beförderung meldet', () => {
    const internUser = { id: 'user-3', isApproved: true, departmentRole: 'INTERN' } as UserModel;
    currentUserSignal.set(internUser);
    
    // ⚡ Effects spülen, damit startPolling() läuft
    TestBed.flushEffects();

    expect(service.graduationPending()).toBeNull();

    // Server meldet 'MEMBER'
    const promotedUser = { id: 'user-3', isApproved: true, departmentRole: 'MEMBER' } as UserModel;
    fetchCurrentStatusSubject.next(promotedUser);

    const graduationEvent = service.graduationPending();
    expect(graduationEvent).not.toBeNull();
    expect(graduationEvent?.source).toBe('LIVE_POLLING');
    expect(graduationEvent?.user.departmentRole).toBe('MEMBER');
  });

  // =========================================================================
  // 4. STOPP BEIM LOGOUT
  // =========================================================================
  it('sollte das Polling sofort beenden, wenn der User ausgeloggt wird', () => {
    const internUser = { id: 'user-4', isApproved: true, departmentRole: 'INTERN' } as UserModel;
    currentUserSignal.set(internUser);
    TestBed.flushEffects();

    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(1);

    isLoggedInSignal.set(false);
    TestBed.flushEffects();

    vi.advanceTimersByTime(300000);
    expect(mockUserService.fetchCurrentStatus).toHaveBeenCalledTimes(1);
  });
});