import { TestBed } from '@angular/core/testing';
import { CentralQueueService } from './central-queue-service';
import { NotificationService } from '../notification/notification-service';
import { QueueItem } from '../../models/queue-items/queue-item';
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

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        { provide: CentralQueueService, useValue: mockCentralQueueService },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    });

    manager = new TestQueueDataManager();
  });

  it('sollte sich bei der Erzeugung automatisch beim CentralQueueService registrieren', () => {
    expect(mockCentralQueueService.registerService).toHaveBeenCalledWith(manager);
  });

  describe('refreshDataIfStale', () => {
    it('sollte Daten laden, wenn der Cooldown abgelaufen ist', (done: () => void) => {
      manager.refreshDataIfStale('user-1').subscribe((result: boolean) => {
        expect(result).toBe(true);
        expect(manager.fetchCall).toHaveBeenCalledWith('user-1');
        done();
      });
    });

    it('sollte den Server-Call throtteln, wenn der Cooldown (30s) noch aktiv ist', (done: () => void) => {
      manager.refreshDataIfStale('user-1').subscribe(() => {
        manager.fetchCall.mockClear();

        manager.refreshDataIfStale('user-1').subscribe((result: boolean) => {
          expect(result).toBe(true);
          expect(manager.fetchCall).not.toHaveBeenCalled();
          done();
        });
      });
    });

    it('🛡️ RACE CONDITION GUARD: Sollte Server-Antwort verwerfen, wenn noch ungelesene Queue-Items existieren', (done: () => void) => {
      mockCentralQueueService.hasPendingItems.mockReturnValue(true);

      manager.refreshDataIfStale('user-1').subscribe(() => {
        expect(mockCentralQueueService.hasPendingItems).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('handleQueueResult', () => {
    it('sollte bei erfolgreichem CREATE die Temp-ID im Cache & Queue austauschen', () => {
      const item: QueueItem = {
        id: 'q-1',
        serviceName: 'TestService',
        action: 'CREATE_NOTE',
        payload: { id: 'temp-123' },
        timestamp: Date.now()
      };

      manager.handleQueueResult(item, true, { id: 'server-999' });

      expect(manager.onEntityCreatedImpl).toHaveBeenCalledWith('temp-123', { id: 'server-999' });
      expect(mockCentralQueueService.updateEntityIdInQueue).toHaveBeenCalledWith('temp-123', 'server-999');
    });

    it('🛑 ROLLBACK: Sollte bei Fehler den alten Snapshot wiederherstellen und Toast anzeigen', () => {
      const snapshot = [{ id: '1', name: 'Original' }];
      const item: QueueItem = {
        id: 'q-1',
        serviceName: 'TestService',
        action: 'UPDATE_NOTE',
        payload: { id: '1', snapshot },
        timestamp: Date.now()
      };

      manager.handleQueueResult(item, false, { status: 400 });

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.any(String),
        'error'
      );
      expect(manager.resetStateImpl).toHaveBeenCalledWith(snapshot);
    });
  });
});