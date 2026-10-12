import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs'; // 👈 WICHTIG: firstValueFrom importieren
import { CentralQueueService } from './central-queue-service';
import { NotificationService } from '../notification/notification-service';
import { LocalStorageService } from '../user/local-storage-service';
import { QueueItem } from '../../models/queue-items/queue-item';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestQueueDataManager } from '../../../../../tests/helpers/test-queue-data-manager';

describe('BaseQueueDataManager (Abstrakte Basisklasse)', () => {
  let manager: TestQueueDataManager;

  const mockCentralQueueService = {
    registerService: vi.fn(),
    hasPendingItems: vi.fn().mockReturnValue(false),
    updateEntityIdInQueue: vi.fn(),
    removeItemsForEntity: vi.fn()
  };

  const mockNotificationService = {
    showNotification: vi.fn()
  };

  const mockLocalStorageService = {
    register: vi.fn(),
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    addDataNotSaved: vi.fn(),
    collectUnsavedDataWarnings: vi.fn().mockReturnValue([])
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        { provide: CentralQueueService, useValue: mockCentralQueueService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: LocalStorageService, useValue: mockLocalStorageService }
      ]
    });

    TestBed.runInInjectionContext(() => {
      manager = new TestQueueDataManager();
    });
  });

  it('sollte sich bei der Erzeugung automatisch beim CentralQueueService registrieren', () => {
    expect(mockCentralQueueService.registerService).toHaveBeenCalledWith(manager.serviceName, manager);
  });

  describe('refreshDataIfStale', () => {
    it('sollte Daten laden, wenn der Cooldown abgelaufen ist', async () => {
      const result = await firstValueFrom(manager.refreshDataIfStale('user-1'));

      expect(result).toBe(true);
      expect(manager.fetchCall).toHaveBeenCalledWith('user-1');
    });

    it('sollte den Server-Call throtteln, wenn der Cooldown (30s) noch aktiv ist', async () => {
      // 1. Erster Aufruf
      await firstValueFrom(manager.refreshDataIfStale('user-1'));
      manager.fetchCall.mockClear();

      // 2. Zweiter Aufruf innerhalb des Cooldowns
      const result = await firstValueFrom(manager.refreshDataIfStale('user-1'));

      expect(result).toBe(true);
      expect(manager.fetchCall).not.toHaveBeenCalled();
    });

    it('🛡️ RACE CONDITION GUARD: Sollte Server-Antwort verwerfen, wenn noch ungelesene Queue-Items existieren', async () => {
      mockCentralQueueService.hasPendingItems.mockReturnValue(true);

      await firstValueFrom(manager.refreshDataIfStale('user-1'));

      expect(mockCentralQueueService.hasPendingItems).toHaveBeenCalled();
    });
  });

  describe('handleQueueResult', () => {
    it('sollte bei erfolgreichem CREATE die Temp-ID im Cache & Queue austauschen', () => {
      const item: QueueItem = {
        id: 'q-1',
        serviceName: QueueHandlerName.TODO,
        action: 'CREATE_NOTE',
        payload: {
          id: 'temp-123',
          displayInfo: { category: 'Test', title: 'Test Item' }
        },
        timestamp: Date.now()
      };

      manager.handleQueueResult(item, true, { id: 'server-999' });

      expect(mockCentralQueueService.updateEntityIdInQueue).toHaveBeenCalledWith('temp-123', 'server-999');
    });

    it('🛑 ROLLBACK: Sollte bei Fehler den alten Snapshot wiederherstellen und Toast anzeigen', () => {
      const snapshot = [{ id: '1', name: 'Original' }];
      const item: QueueItem = {
        id: 'q-1',
        serviceName: QueueHandlerName.TODO,
        action: 'UPDATE_NOTE',
        payload: {
          id: '1',
          snapshot,
          displayInfo: { category: 'Test', title: 'Test Item' }
        },
        timestamp: Date.now()
      };

      manager.handleQueueResult(item, false, { status: 400 });

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.any(String),
        'error'
      );
    });
  });
});