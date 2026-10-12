import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { LaborCentralQueueService } from './labor-central-queue-service';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { IQueueHandler } from './queue-handler-interface';
import { LocalStorageService } from '../user/local-storage-service';
import { AUTH_CONTEXT, IAuthContext } from '../user/auth-context';
import { TestBed } from '@angular/core/testing';

describe('LaborCentralQueueService', () => {
  let service: LaborCentralQueueService;
  let mockHandler1: Partial<IQueueHandler>;
  let mockHandler2: Partial<IQueueHandler>;
  let mockLocalStorageService: Partial<LocalStorageService>;
  let mockAuthContext: Partial<IAuthContext>;

  beforeEach(() => {
    mockLocalStorageService = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    mockAuthContext = {
      getCurrentUserId: vi.fn().mockReturnValue('user-labor-123'),
      isLoggedIn: vi.fn().mockReturnValue(true)
    };

    mockHandler1 = {
      serviceName: QueueHandlerName.DRAFT,
      refreshDataIfStale: vi.fn().mockReturnValue(of(true))
    };

    mockHandler2 = {
      serviceName: QueueHandlerName.USER_SETTINGS,
      refreshDataIfStale: vi.fn().mockReturnValue(throwError(() => new Error('Server-Fehler')))
    };

    TestBed.configureTestingModule({
      providers: [
        LaborCentralQueueService,
        { provide: LocalStorageService, useValue: mockLocalStorageService },
        { provide: AUTH_CONTEXT, useValue: mockAuthContext }
      ]
    });

    service = TestBed.inject(LaborCentralQueueService);

    // Registriere 2 Test-Handler in der Registry
    (service as any).registry.set(QueueHandlerName.DRAFT, mockHandler1 as IQueueHandler);
    (service as any).registry.set(QueueHandlerName.USER_SETTINGS, mockHandler2 as IQueueHandler);
  });

  it('sollte fetchInitialDataForLabor sequentiell für alle Handler ausführen und Fehler abfangen', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    let completed = false;
    service.fetchInitialDataForLabor('user-labor-123').subscribe({
      complete: () => {
        completed = true;
      }
    });

    // Prüfen, ob beide Handler aufgerufen wurden
    expect(mockHandler1.refreshDataIfStale).toHaveBeenCalledWith('user-labor-123');
    expect(mockHandler2.refreshDataIfStale).toHaveBeenCalledWith('user-labor-123');

    // Auch wenn Handler 2 einen Fehler geworfen hat, läuft der Stream dank catchError durch
    expect(completed).toBe(true);
  });

  it('sollte abbrechen und of(true) liefern, wenn keine userId übergeben wird', () => {
    let result = false;
    service.fetchInitialDataForLabor('').subscribe(res => {
      result = res;
    });

    expect(result).toBe(true);
    expect(mockHandler1.refreshDataIfStale).not.toHaveBeenCalled();
  });
});