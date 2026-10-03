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
  let notesSignalMock: ReturnType< typeof signal< Note[] > >; // 👈 Hier mit Leerzeichen!

  let store: Record< string, string > = {};

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

  const createTestNote = (overrides: Partial< NoteInitParams > = {}): Note => {
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

    currentUserSignal = signal< any >({ id: 'user-77', name: 'Zaphod' });

    // 🟢 1. Neues Signal für den DataManager-Mock anlegen
    notesSignalMock = signal< Note[] >([createTestNote({ id: 'zettel-123' })]);

    mockUserService = {
      currentUser: currentUserSignal,
      getCurrentUserId: vi.fn().mockImplementation(() => {
        const user = currentUserSignal();
        return user ? user.id : null;
      })
    };

    // 🟢 2. mockDataManager stellt notesSignal bereit und manipuliert es bei Aufrufen
    mockDataManager = {
      notesSignal: notesSignalMock,
      getNotes: vi.fn().mockReturnValue(of([createTestNote({ id: 'zettel-123' })])),
      createNote: vi.fn().mockImplementation((note: Note) => {
        notesSignalMock.update((list) => [...list, note]);
      }),
      updateNote: vi.fn().mockImplementation((note: Note) => {
        notesSignalMock.update((list) =>
          list.map((n) => (n.id === note.id ? note : n))
        );
      }),
      deleteNote: vi.fn().mockImplementation((id: string) => {
        notesSignalMock.update((list) => list.filter((n) => n.id !== id));
      })
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

  describe('Reaktive Effekte & Cleanup', () => {
    it('sollte beim Starten die Notizen des Users über das Signal bereitstellen', () => {
      TestBed.flushEffects();

      expect(service.notesList().length).toBe(1);
      expect(service.notesList()[0].id).toBe('zettel-123');
    });

    it('sollte beim Ausloggen den Draft löschen und den State zurücksetzen', () => {
      // 1. Vorab einen Draft im LocalStorage speichern
      service.saveDraft({ title: 'Geheimer Entwurf', content: 'Geheim' });
      expect(service.getDraft()).not.toBeNull();

      // 2. Logout / Reset simulieren
      currentUserSignal.set(null);
      notesSignalMock.set([]); // DataManager-Signal wird zurückgesetzt
      service.resetData();     // Löscht den Draft aus dem LocalStorage

      TestBed.flushEffects();

      // 3. Überprüfen: Entwurf ist weg & Notizliste ist leer
      expect(service.getDraft()).toBeNull();
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
      notesSignalMock.set([initialNote]);

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
      notesSignalMock.set([originalNote]);

      const changedNote = createTestNote({ id: 'zettel-123', title: 'Neu Benannt' });

      service.updateNote(changedNote);

      expect(service.notesList()[0].title).toBe('Neu Benannt');
      expect(mockDataManager.updateNote).toHaveBeenCalled();
    });

    it('sollte bei einem API-Fehler einen automatischen Rollback auf den Vorher-Zustand machen', () => {
      // 1. Zustand für diesen Test isolieren
      const originalNote = createTestNote({ id: 'zettel-123', title: 'Zettel-Titel' });
      notesSignalMock.set([originalNote]);

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
      notesSignalMock.set([testNote]);

      service.removeNote('zettel-123');
      expect(service.notesList().length).toBe(0);
    });

    it('sollte bei Lösch-Fehlern den Zettel wieder zurückholen (Rollback)', () => {
      // Zustand für diesen Test isolieren
      const testNote = createTestNote({ id: 'zettel-123' });
      notesSignalMock.set([testNote]);

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
      notesSignalMock.set([testNote]);

      // Jetzt rufen wir die Methode auf
      service.updateNoteStatus('zettel-123', true);

      // Die Notiz muss jetzt erfolgreich aktualisiert worden sein!
      expect(service.notesList()[0].isInCalculation).toBe(true);
    });
  });
});