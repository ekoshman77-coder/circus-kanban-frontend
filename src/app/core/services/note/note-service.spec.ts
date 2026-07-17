import { TestBed } from '@angular/core/testing';
import { NoteService } from './note-service';
import { NoteDataManagerService } from './note-data-manager-service';
import { UserService } from '../user/user-service';
import { Note } from '../../models/note';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

describe('NoteService', () => {
  let service: NoteService;

  let mockDataManager: any;
  let mockUserService: any;
  let currentUserSignal: any;

  let store: Record<string, string> = {};

  // Das explizite Interface, um den TS2345-Fehler endgültig zu eliminieren
  interface NoteInitParams {
    title: string;
    content: string;
    colorType: string;
    userId: string;
    tag?: string | null;
    id?: string | null;
    isInCalculation?: boolean;
    temperature?: number | null;
    weatherCode?: number | null;
  }

  // Die Helferfunktion nutzt jetzt das saubere Interface
  const createTestNote = (overrides: Partial<NoteInitParams> = {}): Note => {
    return new Note({
      userId: 'user-77',
      title: 'Zettel-Titel',
      content: 'Zettel-Inhalt',
      colorType: 'blue',
      ...overrides
    });
  };

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; }
    });

    currentUserSignal = signal<any>({ id: 'user-77', name: 'Zaphod' });

    mockUserService = {
      currentUser: currentUserSignal,
      getCurrentUserId: vi.fn().mockImplementation(() => {
        const user = currentUserSignal();
        return user ? user.id : null;
      })
    };

    mockDataManager = {
      getNotes: vi.fn().mockReturnValue(of([createTestNote({ id: 'zettel-123' })])),
      createNote: vi.fn().mockImplementation((note) => of(note)),
      updateNote: vi.fn().mockImplementation((note) => of(note)),
      deleteNote: vi.fn().mockReturnValue(of(undefined))
    };

    TestBed.configureTestingModule({
      providers: [
        NoteService,
        { provide: NoteDataManagerService, useValue: mockDataManager },
        { provide: UserService, useValue: mockUserService }
      ]
    });

    service = TestBed.inject(NoteService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('Reaktive Effekte (Konstruktor)', () => {
    it('sollte beim Starten die Notizen des Users automatisch laden', () => {
      // ⚡ DER TRICK: Wir zwingen Angular, den effect() im Konstruktor sofort auszuführen!
      TestBed.flushEffects();

      expect(mockDataManager.getNotes).toHaveBeenCalledWith('user-77');
      expect(service.notesList().length).toBe(1);
      expect(service.notesList()[0].id).toBe('zettel-123');
    });

    it('sollte das Signal leeren, wenn sich der User ausloggt', () => {
      // Zuerst Effekte für den Login-Zustand abarbeiten
      TestBed.flushEffects();
      
      // 1. Ausloggen simulieren
      currentUserSignal.set(null);
      
      // Wieder die Effekte triggern, damit der else-Zweig im effect feuert!
      TestBed.flushEffects();
      
      expect(service.notesList()).toEqual([]);
    });
  });

  describe('Draft Management', () => {
    it('sollte Entwürfe sichern, holen und löschen können', () => {
      const sampleDraft = { title: 'Draft-Idee', content: 'Inhalt' };
      
      service.saveDraft(sampleDraft);
      expect(service.getDraft()).toEqual(sampleDraft);

      service.clearDraft();
      expect(service.getDraft()).toBeNull();
    });
  });

  describe('addNote (Zettel erstellen)', () => {
    it('sollte einen neuen Zettel im Signal anhängen', () => {
      // 1. Zustand für diesen Test komplett isolieren
      const initialNote = createTestNote({ id: 'zettel-123' });
      (service as any).notesSignal.set([initialNote]);

      // 2. Aktion ausführen
      service.addNote({
        title: 'Frischer Kaffee',
        content: 'Unbedingt Bohnen kaufen',
        colorType: 'green'
      });

      // 3. Nun können wir uns zu 100% darauf verlassen, dass wir danach 2 Notizen haben!
      expect(service.notesList().length).toBe(2);
      expect(service.notesList()[0].id).toBe('zettel-123');
      expect(service.notesList()[1].title).toBe('Frischer Kaffee');
    });
  });

  describe('updateNote (Optimistische Aktualisierung mit Rollback)', () => {
    it('sollte die Änderung synchron einspielen und bei Servererfolg beibehalten', () => {
      // 1. Zustand für diesen Test isolieren
      const originalNote = createTestNote({ id: 'zettel-123', title: 'Alt' });
      (service as any).notesSignal.set([originalNote]);

      const changedNote = createTestNote({ id: 'zettel-123', title: 'Neu Benannt' });

      service.updateNote(changedNote);

      expect(service.notesList()[0].title).toBe('Neu Benannt');
      expect(mockDataManager.updateNote).toHaveBeenCalled();
    });

    it('sollte bei einem API-Fehler einen automatischen Rollback auf den Vorher-Zustand machen', () => {
      // 1. Zustand für diesen Test isolieren
      const originalNote = createTestNote({ id: 'zettel-123', title: 'Zettel-Titel' });
      (service as any).notesSignal.set([originalNote]);

      const changedNote = createTestNote({ id: 'zettel-123', title: 'Fehler-Titel' });

      // 2. Wir manipulieren den DataManager, so dass er fehlschlägt
      mockDataManager.updateNote.mockReturnValueOnce(throwError(() => new Error('Server Down!')));

      service.updateNote(changedNote);

      // 3. Durch den Rollback muss das Signal wieder auf dem Ursprungswert stehen!
      expect(service.notesList()[0].title).toBe('Zettel-Titel');
    });
  });

  describe('removeNote (Löschen mit Rollback)', () => {
    it('sollte den Zettel synchron entfernen', () => {
      // Zustand für diesen Test isolieren
      const testNote = createTestNote({ id: 'zettel-123' });
      (service as any).notesSignal.set([testNote]);

      service.removeNote('zettel-123');
      expect(service.notesList().length).toBe(0);
    });

    it('sollte bei Lösch-Fehlern den Zettel wieder zurückholen (Rollback)', () => {
      // Zustand für diesen Test isolieren
      const testNote = createTestNote({ id: 'zettel-123' });
      (service as any).notesSignal.set([testNote]);

      mockDataManager.deleteNote.mockReturnValueOnce(throwError(() => new Error('Db Error!')));

      service.removeNote('zettel-123');

      // Dank der Isolation und des Rollbacks muss der Zettel jetzt wieder da sein!
      expect(service.notesList().length).toBe(1);
      expect(service.notesList()[0].id).toBe('zettel-123');
    });
  });
  
  describe('updateNoteStatus', () => {
    it('sollte den Status "isInCalculation" anpassen und updateNote aufrufen', () => {
      // Wir stellen sicher, dass sich die Notiz sicher in der Liste befindet
      const testNote = createTestNote({ id: 'zettel-123', isInCalculation: false });
      
      // Wir setzen den Zustand des Signals manuell auf unsere Testnotiz
      // (Damit umgehen wir jegliche Seiteneffekte aus vorherigen Lösch-Tests!)
      (service as any).notesSignal.set([testNote]);

      // Jetzt rufen wir die Methode auf
      service.updateNoteStatus('zettel-123', true);

      // Die Notiz muss jetzt erfolgreich aktualisiert worden sein!
      expect(service.notesList()[0].isInCalculation).toBe(true);
    });
  });
});