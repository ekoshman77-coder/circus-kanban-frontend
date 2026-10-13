import { TestBed } from '@angular/core/testing';
import { DraftService } from './draft-service';
import { DraftQueueDataManager } from './draft-data-manager';
import { signal } from '@angular/core';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { DraftChain } from '../../models/draft-chain';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { LocalStorageService } from '../user/local-storage-service';
import { mockLocalStorageService } from '@tests/helpers/test-providers';

describe('DraftService', () => {
  let service: DraftService;
  let mockDataManager: any;

  const mockDraftsSignal = signal<DraftChain[]>([]);

  beforeEach(() => {
    mockDraftsSignal.set([
      new DraftChain({
        id: 'labor_1',
        title: 'Labor Notiz & Todo',
        origin: 'LABOR',
        createdAt: 100,
        createdByUserId: 'user-1',
        items: [
          {
            isRootCause: false,
            queueItem: {
              id: 'item_1',
              serviceName: QueueHandlerName.NOTE,
              action: 'CREATE',
              timestamp: 1000,
              payload: {
                id: 'n1',
                displayInfo: { category: 'Notiz', title: 'Test Notiz' }
              }
            }
          },
          {
            isRootCause: false,
            queueItem: {
              id: 'item_2',
              serviceName: QueueHandlerName.TODO,
              action: 'CREATE',
              timestamp: 1001,
              payload: {
                id: 't1',
                displayInfo: { category: 'To-Do', title: 'Test Todo' }
              }
            }
          }
        ]
      }),
      new DraftChain({
        id: 'labor_2',
        title: 'Labor Projekt',
        origin: 'LABOR',
        createdAt: 200,
        createdByUserId: 'user-1',
        items: [
          {
            isRootCause: false,
            queueItem: {
              id: 'item_3',
              serviceName: QueueHandlerName.PROJECT,
              action: 'CREATE',
              timestamp: 1002,
              payload: {
                id: 'p1',
                displayInfo: { category: 'Projekt', title: 'Test Projekt' }
              }
            }
          }
        ]
      }),
      new DraftChain({
        id: 'local_1',
        title: 'Lokaler Entwurf',
        origin: 'LOCAL',
        createdAt: 300,
        createdByUserId: 'user-1',
        items: [
          {
            isRootCause: false,
            queueItem: {
              id: 'item_4',
              serviceName: QueueHandlerName.NOTE,
              action: 'CREATE',
              timestamp: 1003,
              payload: {
                id: 'n2',
                displayInfo: { category: 'Notiz', title: 'Lokale Notiz' }
              }
            }
          }
        ]
      })
    ]);

    mockDataManager = {
      draftChainsSignal: mockDraftsSignal,
      promoteLaborDraftsToRealWorld: vi.fn(),
      reinjectDraftChain: vi.fn(),
      delegateDraftChain: vi.fn(),
      removeDraftChain: vi.fn(),
      saveDraftChain: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        DraftService,
        { provide: DraftQueueDataManager, useValue: mockDataManager },
        { provide: LocalStorageService, useValue: mockLocalStorageService }
      ]
    });

    service = TestBed.inject(DraftService);
  });

  it('sollte laborDrafts korrekt filtern und sandboxSummary berechnen', () => {
    const laborDrafts = service.laborDrafts();
    expect(laborDrafts.length).toBe(2);
    expect(laborDrafts.map(d => d.id)).toEqual(['labor_1', 'labor_2']);

    const summary = service.sandboxSummary();
    expect(summary.totalChains).toBe(2);
    expect(summary.notesCount).toBe(1);
    expect(summary.todosCount).toBe(1);
    expect(summary.projectsCount).toBe(1);
  });

  it('sollte promoteLaborDraftsToRealWorld an den DataManager delegieren', () => {
    service.promoteLaborDraftsToRealWorld();
    expect(mockDataManager.promoteLaborDraftsToRealWorld).toHaveBeenCalledTimes(1);
  });

  it('sollte reinjectDraftChain an den DataManager delegieren', () => {
    service.reinjectDraftChain('labor_1', []);
    expect(mockDataManager.reinjectDraftChain).toHaveBeenCalledWith('labor_1', []);
  });

  it('sollte updateDraftItemPayload das Item aktualisieren und saveDraftChain rufen', () => {
    const updatedPayload = {
      id: 'n1',
      displayInfo: { category: 'Notiz', title: 'Geänderter Inhalt' }
    };
    
    service.updateDraftItemPayload('labor_1', 'item_1', updatedPayload);

    expect(mockDataManager.saveDraftChain).toHaveBeenCalledTimes(1);
    const savedDraft: DraftChain = mockDataManager.saveDraftChain.mock.calls[0][0];
    
    expect(savedDraft.id).toBe('labor_1');
    expect(savedDraft.items[0].queueItem.payload).toEqual(updatedPayload);
  });

  it('checkUnsavedData sollte lokales Vorkommen zurückgeben', () => {
    expect(service.checkUnsavedData()).toBe('Es gibt noch ungespeicherte lokale Entwürfe.');
  });
});