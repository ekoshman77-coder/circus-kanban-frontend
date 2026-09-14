import { TestBed } from '@angular/core/testing';
import { CentralQueueService } from './central-queue-service';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service';
import { LocalStorageService } from '../user/local-storage-service';
import { Observable, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestQueueDataManager } from '../../../../../tests/helpers/test-queue-data-manager';
import { signal } from '@angular/core';

describe('CentralQueueService', () => {
  let service: CentralQueueService;
  let dataManager: TestQueueDataManager;

  // Signal-basierte Mocks passend zu euren Services
  const mockIsOnlineSignal = signal(true);
  const mockIsOfflineSignal = signal(false);
  const mockIsLoggedInSignal = signal(true);

  const mockConnectionService = {
    isOnline: mockIsOnlineSignal,
    isOffline: mockIsOfflineSignal
  };

  const mockUserService = {
    isLoggedIn: mockIsLoggedInSignal,
    getCurrentUserId: vi.fn().mockReturnValue('user-123')
  };

  const mockLocalStorageService = {
    getItem: vi.fn().mockReturnValue([]),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    register: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnlineSignal.set(true);
    mockIsOfflineSignal.set(false);
    mockIsLoggedInSignal.set(true);

    TestBed.configureTestingModule({
      providers: [
        CentralQueueService,
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: UserService, useValue: mockUserService },
        { provide: LocalStorageService, useValue: mockLocalStorageService }
      ]
    });

    service = TestBed.inject(CentralQueueService);
    dataManager = new TestQueueDataManager();
  });

  it('sollte den Service korrekt initialisieren', () => {
    expect(service).toBeTruthy();
  });

  it('sollte ein neues Item einreihen (enqueue) und im LocalStorage speichern', () => {
    const payload = { id: 'local-1' };
    const item = service.enqueue('TestService', 'CREATE_NOTE', payload);

    expect(item.id).toBeDefined();
    expect(mockLocalStorageService.setItem).toHaveBeenCalled();
  });

  it('sollte bei Offline-Status keine Requests ausführen', async () => {
    mockIsOfflineSignal.set(true);
    mockIsOnlineSignal.set(false);

    service.enqueue('TestService', 'CREATE_NOTE', { id: 'local-1' });
    await service.processQueue();

    expect(dataManager.executeCall).not.toHaveBeenCalled();
    expect(service.getQueue().length).toBe(1);
  });

  it('sollte 4xx Fehler stornieren und das Item aus der Queue entfernen', async () => {
    dataManager.executeCall.mockReturnValue(throwError(() => ({ status: 400 })));

    service.enqueue('TestService', 'CREATE_NOTE', { id: 'local-1' });

    expect(dataManager.executeCall).toHaveBeenCalledTimes(1);
    expect(service.getQueue().length).toBe(0);
  });

  it('sollte bei 5xx Netzwerkfehlern das Item in der Queue behalten', async () => {
    dataManager.executeCall.mockReturnValue(throwError(() => ({ status: 500 })));

    service.enqueue('TestService', 'CREATE_NOTE', { id: 'local-1' });

    expect(dataManager.executeCall).toHaveBeenCalledTimes(1);
    expect(service.getQueue().length).toBe(1);
  });

  it('🛑 LOOP-CHECK: Sollte bei leerer Queue nach dem Refresh stoppen und NICHT in die Schleife geraten', () => {
    service.processQueue();
    expect(dataManager.fetchCall).toHaveBeenCalledWith('user-123');
    expect(service.isFetching()).toBe(false);
  });
});