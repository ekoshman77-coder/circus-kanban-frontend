import { TestBed } from '@angular/core/testing';
import { IdeaSortingService } from './idea-sorting-service';
import { UserService } from '../user/user-service';
import { NoteService } from './note-service';
import { NoteSortOrder } from '../../models/note-sort-order';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { IUserInit, UserModel } from '../../models/user-model';

describe('IdeaSortingService (Vitest - Strictly Typed)', () => {
  let service: IdeaSortingService;

  // Typsichere Mocks
  let mockUserService: Partial<UserService>;
  let mockNoteService: Partial<NoteService>;
  let currentUserSignal: WritableSignal<UserModel | null>;

  // Helper zum Erstellen eines Test-Users
  const createTestUser = (overrides: Partial<IUserInit> = {}): UserModel => {
    return new UserModel({
      id: 'user-42',
      username: 'zaphod',
      firstName: 'Zaphod',
      lastName: 'Beeblebrox',
      department: null,
      isApproved: true,
      projectIds: [],
      ...overrides
    });
  };

  // LocalStorage Mock-Store
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; }
    });

    currentUserSignal = signal<UserModel | null>(null);

    mockUserService = {
      currentUser: currentUserSignal,
      getCurrentUserId: vi.fn().mockImplementation(() => {
        const user = currentUserSignal();
        return user ? user.id : null;
      })
    };

    mockNoteService = {
      loadNotes: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        IdeaSortingService,
        { provide: UserService, useValue: mockUserService },
        { provide: NoteService, useValue: mockNoteService }
      ]
    });

    service = TestBed.inject(IdeaSortingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('Reaktive Initialisierung über den User-Wechsel (effect)', () => {
    it('sollte bei nicht-eingeloggtem User keine Notizen laden', () => {
      currentUserSignal.set(null);
      TestBed.flushEffects();

      expect(mockNoteService.loadNotes).not.toHaveBeenCalled();
    });

    it('sollte beim Einloggen eines Users loadNotes triggern', () => {
      currentUserSignal.set(createTestUser({ id: 'user-42' }));
      TestBed.flushEffects();

      expect(mockNoteService.loadNotes).toHaveBeenCalled();
    });
  });

  describe('loadSorting & saveSorting (Context-basiert)', () => {
    const contextKey = 'board-view';

    it('sollte leere Sortierung liefern, wenn kein User eingeloggt ist', () => {
      currentUserSignal.set(null);

      const result = service.loadSorting(contextKey);
      expect(result).toEqual([]);
    });

    it('sollte nichts speichern, wenn kein User eingeloggt ist', () => {
      currentUserSignal.set(null);

      const orders: NoteSortOrder[] = [{ noteId: 'note-1', sortIndex: 0 }];
      service.saveSorting(contextKey, orders);

      expect(localStorage.getItem('my_note_sorting_null_board-view')).toBeNull();
    });

    it('sollte die Sortierung im LocalStorage speichern und wieder laden', () => {
      currentUserSignal.set(createTestUser({ id: 'user-42' }));
      TestBed.flushEffects();

      // Korrekte NoteSortOrder-Struktur
      const orders: NoteSortOrder[] = [
        { noteId: 'note-1', sortIndex: 0 },
        { noteId: 'note-2', sortIndex: 1 }
      ];
      
      // Speichern mit Context-Key
      service.saveSorting(contextKey, orders);

      // Prüfen im LocalStorage mit dem exakten Key-Schema des Services
      const stored = localStorage.getItem('my_note_sorting_user-42_board-view');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(orders);

      // Wieder auslesen via Service
      const loaded = service.loadSorting(contextKey);
      expect(loaded).toEqual(orders);
    });
  });
});