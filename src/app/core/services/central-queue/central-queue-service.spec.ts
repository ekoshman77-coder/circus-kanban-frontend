import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';

import { CentralQueueService } from './central-queue-service';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { SnapshotPayload, QueueItem } from '../../models/queue-items/queue-item';
import { DraftStateProvider } from '../draft-chains/draft-state-provider';
import { DraftQueueDataManager } from '../draft-chains/draft-data-manager';
import { AUTH_CONTEXT, IAuthContext } from '../user/auth-context';
import { IQueueHandler } from './queue-handler-interface';
import { LocalStorageService } from '../user/local-storage-service';
import { ConnectionService } from '../connection/connection-service';
import { DraftRepository } from '../../repositories/draft-repository';
import { UserService } from '../user/user-service';

describe('CentralQueueService - Lawinen-Extraktion, Draft & Recovery (Vitest)', () => {
  let queueService: CentralQueueService;
  let draftProvider: DraftStateProvider;
  let draftManager: DraftQueueDataManager;

  let mockAuthContext: Partial<IAuthContext>;
  let mockConnectionService: Partial<ConnectionService>;
  let mockLocalStorageService: Partial<LocalStorageService>;
  let mockHandler: IQueueHandler;

  let executeSubjects: Subject<any>[];

  beforeEach(() => {
    executeSubjects = [];

    mockLocalStorageService = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      register: vi.fn()
    };

    mockConnectionService = {
      isOnline: signal<boolean>(true),
      isOffline: signal<boolean>(false)
    };

    mockAuthContext = {
      isLoggedIn: vi.fn().mockReturnValue(true),
      getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    mockHandler = {
      serviceName: QueueHandlerName.DRAFT,
      executeQueueItem: vi.fn().mockImplementation(() => {
        const subj = new Subject<any>();
        executeSubjects.push(subj);
        return subj.asObservable();
      }),
      handleQueueResult: vi.fn(),
      enableShadowMode: vi.fn(),
      rollbackItem: vi.fn(),
      applyRollForward: vi.fn(),
      dependsOnId: vi.fn().mockImplementation((item: QueueItem, ids: Set<string>) => {
        const itemNum = parseInt(item.payload?.id?.replace(/\D/g, '') || '0', 10);

        // Gehe alle fehlerhaften IDs im Set durch
        for (const failedId of ids) {
          const failedNum = parseInt(failedId.replace(/\D/g, '') || '0', 10);

          // Regel: Beide sind gerade ODER beide sind ungerade -> Abhängigkeit!
          if (itemNum % 2 === failedNum % 2) {
            return true;
          }
        }
        return false;
      }),

      extractEntityIds: vi.fn().mockImplementation((item: QueueItem) => [item.payload?.id]),
      checkAndReplaceIds: vi.fn(),
      forceFetchFromServer: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        CentralQueueService,
        DraftStateProvider,
        DraftQueueDataManager,
        { provide: LocalStorageService, useValue: mockLocalStorageService },
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: AUTH_CONTEXT, useValue: mockAuthContext },
        {
          provide: DraftRepository,
          useValue: {
            delegateDraft: vi.fn().mockReturnValue(of(true)),
            deleteServerDraft: vi.fn().mockReturnValue(of(true)),
            fetchAssignedDrafts: vi.fn().mockReturnValue(of([]))
          }
        },
        { provide: UserService, useValue: { currentUser: signal(null) } }
      ]
    });

    queueService = TestBed.inject(CentralQueueService);
    draftManager = TestBed.inject(DraftQueueDataManager);
    draftProvider = (draftManager as any).draftState;

    queueService.setFetchingState(false);
    (queueService as any).registry.set(QueueHandlerName.DRAFT, mockHandler);
  });

  it('sollte bei 4xx-Fehler die Lawine extrahieren, Shadow-Rollback/Replay ausführen und nach Reinject sauber verarbeiten', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => { });

    // 1. DREI ZUSAMMENHÄNGENDE PAYLOADS VORBEREITEN
    const payload1: SnapshotPayload = {
      id: 'entity_1',
      snapshot: [{ id: 'entity_1', status: 'INIT' }],
      displayInfo: { category: 'Queue', title: 'Aktion 1' }
    };

    const payload2: SnapshotPayload = {
      id: 'entity_2',
      snapshot: [{ id: 'entity_2', status: 'PENDING' }],
      displayInfo: { category: 'Queue', title: 'Aktion 2 (Schlägt fehl)' }
    };

    const payload3: SnapshotPayload = {
      id: 'entity_3',
      snapshot: [{ id: 'entity_3', status: 'PENDING' }],
      displayInfo: { category: 'Queue', title: 'Aktion 3 unabhängig' }
    };

    const payload4: SnapshotPayload = {
      id: 'entity_4',
      snapshot: [{ id: 'entity_4', status: 'PENDING' }],
      displayInfo: { category: 'Queue', title: 'Aktion 4 (abhängig)' }
    };

    const payload5: SnapshotPayload = {
      id: 'entity_5',
      snapshot: [{ id: 'entity_5', status: 'PENDING' }],
      displayInfo: { category: 'Queue', title: 'Aktion 5 unabhängig' }
    };


    // 2. ENQUEUE ALLER 3 ITEMS
    queueService.enqueue(QueueHandlerName.DRAFT, 'EXECUTE_STEP', payload1);
    queueService.enqueue(QueueHandlerName.DRAFT, 'EXECUTE_STEP', payload2);
    queueService.enqueue(QueueHandlerName.DRAFT, 'EXECUTE_STEP', payload3);
    queueService.enqueue(QueueHandlerName.DRAFT, 'EXECUTE_STEP', payload4);
    queueService.enqueue(QueueHandlerName.DRAFT, 'EXECUTE_STEP', payload5);

    // 3. ITEM 1 ERFOLGREICH VERARBEITEN
    expect(executeSubjects.length).toBeGreaterThanOrEqual(1);
    executeSubjects[0].next({ success: true, id: 'entity_1' });
    executeSubjects[0].complete();
    expect(queueService.getQueue().length).toBe(4);

    // PRÜFUNG ITEM 1: Handler wurde mit dem ersten Payload aufgerufen
    expect(mockHandler.executeQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ payload: payload1 })
    );

    // 4. ITEM 2 MIT 400 FEHLER BEANTWORTEN
    expect(executeSubjects.length).toBeGreaterThanOrEqual(2);
    executeSubjects[1].error({
      status: 400,
      error: { message: 'Validierungsfehler in Feld X' }
    });

// 5. AUTOMATISCHE PRÜFUNG NACH DEM 4XX-HANDLER
    // A) Queue enthält nach Lawine noch 2 unabhängige Items in der Warteschlange
    // Da entity_3 sofort gestartet wird, wartet noch 1 Item (entity_5) in getQueue()
    const drafts = draftProvider.getState();
    expect(drafts.length).toBe(1);

    const createdDraft = drafts[0];
    expect(createdDraft.items.length).toBe(2);

    // Prüfen, ob Item 2 die Ursache (Root Cause) ist und Item 4 als Nachfolger mitkam
    expect(createdDraft.items[0].isRootCause).toBe(true);
    expect(createdDraft.items[0].queueItem.payload.id).toBe('entity_2');
    expect(createdDraft.items[1].queueItem.payload.id).toBe('entity_4');
    expect(createdDraft.lastErrorCode).toBe(400);

    // 🟢 WARTE AUF DEN processQueue()-SETTIMEOUT DES SERVICE
    await new Promise(resolve => setTimeout(resolve, 0));

    // 5b. UNABHÄNGIGE REST-ITEMS WERDEN IM HINTERGRUND WEITERVERARBEITET
    // Item 3 wird als nächstes automatisch gestartet
    expect(executeSubjects.length).toBe(3); 
    executeSubjects[2].next({ success: true, id: 'entity_3' });
    executeSubjects[2].complete();

    // Item 5 wird danach gestartet
    expect(executeSubjects.length).toBe(4);
    executeSubjects[3].next({ success: true, id: 'entity_5' });
    executeSubjects[3].complete();

    // Die Hauptqueue ist nun leer, während der Draft auf Korrektur wartet
    expect(queueService.getQueue().length).toBe(0);

    // 6. DRAFT KORREKTUR SIMULIEREN & REINJECT
    const executionsBeforeReinject = executeSubjects.length; // 4

    const updatedItems = structuredClone(createdDraft.items);
    updatedItems[0].queueItem.payload.displayInfo.title = 'Aktion 2 korrigiert';

    draftManager.reinjectDraftChain(createdDraft.id, updatedItems);

    // Draft ist nach Reinject gelöscht
    expect(draftProvider.getState().length).toBe(0);

    // 7. KORRIGIERTE DRAFT-ITEMS SAUBER ABSCHLIESSEN
    // Nach dem Reinject werden entity_2 und entity_4 verarbeitet
    expect(executeSubjects.length).toBe(executionsBeforeReinject + 1); // 4 Subjects insgesamt

    // Korrigiertes Item 2 verarbeiten (Subject Index 4)
    executeSubjects[4].next({ success: true, id: 'entity_2' });
    executeSubjects[4].complete();

    // 🟢 kurz auf processQueue() für das nächste re-injizierte Item warten
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(executeSubjects.length).toBe(executionsBeforeReinject + 2); // 4 Subjects insgesamt

    // Korrigiertes Item 4 (aus der Lawine) verarbeiten (Subject Index 5)
    executeSubjects[5].next({ success: true, id: 'entity_4' });
    executeSubjects[5].complete();

    // 8. FINALER ZUSTAND: Alle 5 Items abgearbeitet -> Queue komplett leer
    expect(queueService.getQueue().length).toBe(0);
  });
});