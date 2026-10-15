import { DraftStateProvider } from './draft-state-provider';
import { UserService } from '../user/user-service';
import { signal } from '@angular/core';
import { DraftChain } from '../../models/draft-chain';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from '../user/local-storage-service';

describe('DraftStateProvider', () => {
  let provider: DraftStateProvider;

  let mockUserService: any;
  let mockLocalStorageService: any;
  let currentUserSignal = signal<{ id: string; username: string } | null>({ id: 'user-123', username: 'alex' });

  beforeEach(() => {
    currentUserSignal.set({ id: 'user-123', username: 'alex' });

    mockUserService = {
      currentUser: currentUserSignal
    };

    mockLocalStorageService = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: LocalStorageService, useValue: mockLocalStorageService }
      ]
    });

    // Da DraftStateProvider `inject()` nutzt, erzeugen wir ihn im Injection Context von TestBed
    provider = TestBed.runInInjectionContext(() => new DraftStateProvider());
  });

  it('sollte den benutzer-isolierten Storage-Key dynamisch bilden', () => {
    // 1. Für User 123
    expect((provider as any).storageKey).toBe('sandbox_drafts_user-123');

    // 2. Wechsel auf User 456
    currentUserSignal.set({ id: 'user-456', username: 'maria' });
    expect((provider as any).storageKey).toBe('sandbox_drafts_user-456');

    // 3. Wenn kein User eingeloggt ist -> Fallback Key
    currentUserSignal.set(null);
    expect((provider as any).storageKey).toBe('global_draft_chains_store');
  });

  it('sollte SAVE_DRAFT_CHAIN und REMOVE_DRAFT_CHAIN korrekt ausführen', () => {
    const chain = new DraftChain({
      id: 'chain_1',
      title: 'Test Entwurf',
      origin: 'LABOR',
      items: []
    });

    // Kette speichern
    provider.applyActionPayload('SAVE_DRAFT_CHAIN', { chain });
    expect(provider.getState().length).toBe(1);
    expect(provider.getState()[0].id).toBe('chain_1');

    // Kette entfernen
    provider.applyActionPayload('REMOVE_DRAFT_CHAIN', { chainId: 'chain_1' });
    expect(provider.getState().length).toBe(0);
  });

  it('sollte mergeDraftChains atomar alte Ketten entfernen und die neue Kette einfügen', () => {
    const chain1 = new DraftChain({ id: 'old_1', title: 'Alt 1', origin: 'LABOR', items: [] });
    const chain2 = new DraftChain({ id: 'old_2', title: 'Alt 2', origin: 'LABOR', items: [] });
    
    provider.saveDraftChain(chain1);
    provider.saveDraftChain(chain2);
    expect(provider.getState().length).toBe(2);

    const mergedChain = new DraftChain({
      id: 'merged_1',
      title: 'Zusammengeführt',
      origin: 'LABOR',
      items: []
    });

    // Ketten 'old_1' und 'old_2' durch 'merged_1' ersetzen
    provider.mergeDraftChains(['old_1', 'old_2'], mergedChain);

    const currentState = provider.getState();
    expect(currentState.length).toBe(1);
    expect(currentState[0].id).toBe('merged_1');
  });

  it('sollte syncRemoteDrafts Server-Drafts übernehmen und reine LOCAL-Drafts behalten', () => {
    const localDraft = new DraftChain({ id: 'local_1', title: 'Lokal', origin: 'LOCAL', items: [] });
    provider.saveDraftChain(localDraft);

    const remoteDtos: any[] = [
      {
        id: 'remote_1',
        title: 'Server Entwurf',
        origin: 'REMOTE',
        items: [],
        createdAt: 1000,
        createdByUserId: 'user-123'
      }
    ];

    provider.syncRemoteDrafts(remoteDtos);

    const currentState = provider.getState();
    expect(currentState.length).toBe(2);
    expect(currentState.map(c => c.id)).toContain('local_1');
    expect(currentState.map(c => c.id)).toContain('remote_1');
  });

  it('sollte clearUserDrafts den State leeren und das Item aus dem LocalStorage entfernen', () => {
    const chain = new DraftChain({ id: 'chain_1', title: 'Test', origin: 'LABOR', items: [] });
    provider.saveDraftChain(chain);

    provider.clearUserDrafts();

    expect(provider.getState().length).toBe(0);
    expect(mockLocalStorageService.removeItem).toHaveBeenCalledWith('sandbox_drafts_user-123');
  });
});