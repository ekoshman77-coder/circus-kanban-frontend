import { TestBed } from '@angular/core/testing';
import { IdeaSortingService } from './idea-sorting-service';
import { UserService } from '../user/user-service';
import { NoteService } from './note-service';
import { NoteSortOrder } from '../../models/note-sort-order';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';

describe('IdeaSortingService', () => {
  let service: IdeaSortingService;

  // Mocks
  let mockUserService: any;
  let mockNoteService: any;
  let currentUserSignal: any;

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

    // Wir starten ohne eingeloggten User
    currentUserSignal = signal<any>(null);

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

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('Reaktive Initialisierung über den User-Wechsel (effect)', () => {
    it('sollte bei nicht-eingeloggtem User die Sortierung leer halten und keine Notizen laden', () => {
      currentUserSignal.set(null);
      TestBed.flushEffects();

      expect(service.currentSortOrders()).toEqual([]);
      expect(mockNoteService.loadNotes).not.toHaveBeenCalled();
    });

    it('sollte beim Einloggen eines Users leere Standard-Sortierungen setzen, wenn kein LocalStorage existiert, und loadNotes triggern', () => {
      currentUserSignal.set({ id: 'user-42', name: 'Zaphod' });
      TestBed.flushEffects();

      expect(service.currentSortOrders()).toEqual([]);
      expect(mockNoteService.loadNotes).toHaveBeenCalled();
    });

    it('sollte beim Einloggen eines Users gespeicherte Einstellungen aus dem LocalStorage laden', () => {
      const savedOrders: NoteSortOrder[] = [
        { field: 'createdAt', direction: 'desc' } as any
      ];
      localStorage.setItem('my_note_sorting_user-42', JSON.stringify(savedOrders));

      currentUserSignal.set({ id: 'user-42', name: 'Zaphod' });
      TestBed.flushEffects();

      expect(service.currentSortOrders()).toEqual(savedOrders);
      expect(mockNoteService.loadNotes).toHaveBeenCalled();
    });
  });

  describe('saveSorting (Sortierung speichern)', () => {
    it('sollte nichts tun, wenn kein User eingeloggt ist', () => {
      currentUserSignal.set(null);
      TestBed.flushEffects();

      const newOrders: NoteSortOrder[] = [{ field: 'title', direction: 'asc' } as any];
      service.saveSorting(newOrders);

      expect(localStorage.getItem('my_note_sorting_null')).toBeNull();
    });

    it('sollte das Signal aktualisieren und im LocalStorage des Users speichern', () => {
      currentUserSignal.set({ id: 'user-1337', name: 'Neo' });
      TestBed.flushEffects();

      const newOrders: NoteSortOrder[] = [{ field: 'title', direction: 'asc' } as any];
      service.saveSorting(newOrders);

      // Signal muss aktualisiert sein
      expect(service.currentSortOrders()).toEqual(newOrders);

      // LocalStorage Eintrag prüfen
      const stored = localStorage.getItem('my_note_sorting_user-1337');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(newOrders);
    });
  });
});