import { DraftQueueDataManager } from './draft-data-manager';
import { CentralQueueService } from '../central-queue/central-queue-service';
import { DraftRepository } from '../../repositories/draft-repository';
import { UserService } from '../user/user-service';
import { AUTH_CONTEXT } from '../user/auth-context';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { DraftChain } from '../../models/draft-chain';
import { Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { LocalStorageService } from '../user/local-storage-service';
import { mockLocalStorageService } from '@tests/helpers/test-providers';
import { TestBed } from '@angular/core/testing';

describe('DraftQueueDataManager', () => {
  let manager: DraftQueueDataManager;

  let mockQueueService: any;
  let mockDraftRepository: any;
  let mockUserService: any;
  let mockAuthContext: any;

  let draftChainCreatedSubject: Subject<DraftChain>;
  let laborModeExitedSubject: Subject<void>;

  beforeEach(() => {
    draftChainCreatedSubject = new Subject<DraftChain>();
    laborModeExitedSubject = new Subject<void>();

    mockQueueService = {
      isLaborMode: signal(false), // 👈 NEU: isLaborMode Signal im Mock ergänzt!
      draftChainCreated$: draftChainCreatedSubject.asObservable(),
      laborModeExited$: laborModeExitedSubject.asObservable(),
      registerService: vi.fn(),
      enqueue: vi.fn(),
      processQueue: vi.fn(),
      reinjectChain: vi.fn(),
      flushLaborItemsAndSwitchMode: vi.fn(),
      isItemDependentOnChain: vi.fn().mockReturnValue(false)
    };

    mockDraftRepository = {
      delegateDraft: vi.fn().mockReturnValue(of(true)),
      deleteServerDraft: vi.fn().mockReturnValue(of(true)),
      fetchAssignedDrafts: vi.fn().mockReturnValue(of([]))
    };

    mockUserService = {
      currentUser: signal({ id: 'user-123', username: 'alex' })
    };

    mockAuthContext = {
      getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    TestBed.configureTestingModule({
      providers: [
        DraftQueueDataManager,
        { provide: CentralQueueService, useValue: mockQueueService },
        { provide: DraftRepository, useValue: mockDraftRepository },
        { provide: UserService, useValue: mockUserService },
        { provide: AUTH_CONTEXT, useValue: mockAuthContext },
        { provide: LocalStorageService, useValue: mockLocalStorageService}
      ]
    });

    manager = TestBed.inject(DraftQueueDataManager);
  });

  it('sollte promoteLaborDraftsToRealWorld Labor-Items flushen und Sandbox zurücksetzen', () => {
    mockQueueService.isLaborMode.set(true); // 👈 Für Labor-Tests isLaborMode auf true setzen

    const laborDraft = new DraftChain({
      id: 'labor_1',
      title: 'Labor Notiz',
      origin: 'LABOR',
      items: [
        {
          isRootCause: false,
          queueItem: {
            id: 'q_1',
            serviceName: QueueHandlerName.NOTE,
            action: 'CREATE',
            timestamp: 100,
            payload: { id: 'n1', displayInfo: { category: 'Notiz', title: 'Labor Notiz' } }
          }
        }
      ]
    });

    manager.saveDraftChain(laborDraft);
    expect(manager.draftChainsSignal().length).toBe(1);

    manager.promoteLaborDraftsToRealWorld();

    expect(mockQueueService.flushLaborItemsAndSwitchMode).toHaveBeenCalledWith([laborDraft.items[0].queueItem]);
    expect(manager.draftChainsSignal().length).toBe(0);
  });

  it('sollte exportDraftPackageJson die Labor-Entwürfe als JSON-String ausgeben', () => {
    mockQueueService.isLaborMode.set(true); // 👈 Für Labor-Tests isLaborMode auf true setzen

    const laborDraft = new DraftChain({
      id: 'labor_1',
      title: 'Export Test',
      origin: 'LABOR',
      items: []
    });

    manager.saveDraftChain(laborDraft);

    const jsonString = manager.exportDraftPackageJson();
    const parsed = JSON.parse(jsonString);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe('labor_1');
  });

  it('sollte delegateDraftChain die Kette aktualisieren und DELEGATE_DRAFT enqueuen', () => {
    const draft = new DraftChain({
      id: 'draft_1',
      title: 'Zum Delegieren',
      origin: 'LOCAL',
      items: []
    });

    manager.saveDraftChain(draft);

    manager.delegateDraftChain('draft_1', 'MENTOR' as any, 'Bitte prüfen!');

    expect(mockQueueService.enqueue).toHaveBeenCalledWith(
      QueueHandlerName.DRAFT,
      'DELEGATE_DRAFT',
      expect.objectContaining({
        id: 'draft_1',
        displayInfo: {
          category: 'Entwurf delegieren',
          title: 'Zum Delegieren'
        }
      })
    );
  });

  it('sollte bei laborModeExited$ automatisch promoteLaborDraftsToRealWorld ausführen', () => {
    const spy = vi.spyOn(manager, 'promoteLaborDraftsToRealWorld');

    laborModeExitedSubject.next();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // 🧪 NEUER TEST: Filterung je nach isLaborMode Signal prüfen
  it('sollte draftChainsSignal je nach isLaborMode filtern', () => {
    const liveDraft = new DraftChain({
      id: 'live_1',
      title: 'Live Draft',
      origin: 'LOCAL',
      items: []
    });

    const laborDraft = new DraftChain({
      id: 'labor_1',
      title: 'Labor Draft',
      origin: 'LABOR',
      items: []
    });

    manager.saveDraftChain(liveDraft);
    manager.saveDraftChain(laborDraft);

    // Live-Modus:
    mockQueueService.isLaborMode.set(false);
    expect(manager.draftChainsSignal().length).toBe(1);
    expect(manager.draftChainsSignal()[0].id).toBe('live_1');

    // Labor-Modus:
    mockQueueService.isLaborMode.set(true);
    expect(manager.draftChainsSignal().length).toBe(1);
    expect(manager.draftChainsSignal()[0].id).toBe('labor_1');
  });
});