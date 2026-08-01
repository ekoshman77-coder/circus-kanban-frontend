import { TestBed } from '@angular/core/testing';
import { NoteDataManagerService } from './note-data-manager-service';
import { ConnectionService } from '../connection/connection-service';
import { NoteRepository } from '../../repositories/note-repository';
import { Note } from '../../models/note';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { map, of, Subject } from 'rxjs';
import { signal } from '@angular/core';

describe('NoteDataManagerService', () => {
  let service: NoteDataManagerService;

  // Mocks
  let mockConnectionService: any;
  let mockNoteRepository: any;
  let connectionStatusSignal: any;

  // LocalStorage Mock
  let store: Record<string, string> = {};

  // Interface exakt spiegeln für die Helferfunktion
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

  // Die Helferfunktion bekommt einen absolut sauberen, expliziten Typ
  const createTestNote = (overrides: Partial<NoteInitParams> = {}): Note => {
    return new Note({
      userId: 'user-1',
      title: 'Standard Title',
      content: 'Standard Content',
      colorType: 'yellow',
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

    connectionStatusSignal = signal<'ONLINE' | 'OFFLINE'>('ONLINE');
    mockConnectionService = {
      status: connectionStatusSignal
    };

    mockNoteRepository = {
      getNotesByUserId: vi.fn().mockReturnValue(of([createTestNote({ id: '1', title: 'Server Note' })])),
      createNote: vi.fn().mockImplementation((note) => of(createTestNote({ ...note, id: 'server-id-99' }))),
      updateNote: vi.fn().mockImplementation((id, note) => of(createTestNote({ ...note, title: 'Updated on Server' }))),
      deleteNote: vi.fn().mockReturnValue(of(undefined))
    };

    TestBed.configureTestingModule({
      providers: [
        NoteDataManagerService,
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: NoteRepository, useValue: mockNoteRepository }
      ]
    });

    service = TestBed.inject(NoteDataManagerService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('getNotes (Notizen laden)', () => {
    it('sollte online Daten vom Server holen und das lokale Backup aktualisieren', () => {
      service.getNotes('user-1').subscribe((notes: Note[]) => {
        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('Server Note');

        const backup = localStorage.getItem('global_notes_pool');
        expect(backup).toContain('Server Note');
      });
    });

    it('sollte offline oder bei Server-Fehlern sofort auf den lokalen Cache ausweichen', () => {
      const cachedNotes = [createTestNote({ id: 'cached-1', title: 'Offline Note' })];
      localStorage.setItem('global_notes_pool', JSON.stringify(cachedNotes));

      connectionStatusSignal.set('OFFLINE');

      service.getNotes('user-1').subscribe((notes: Note[]) => {
        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('Offline Note');
        expect(mockNoteRepository.getNotesByUserId).not.toHaveBeenCalled();
      });
    });
  });

describe('createNote (Notiz erstellen)', () => {
    it('sollte offline eine temporäre ID vergeben und die Notiz lokal puffern', () => {
      connectionStatusSignal.set('OFFLINE');
      
      // 1. Wir erstellen die Test-Notiz
      const newNote = createTestNote({ title: 'Neuer Zettel' });
      
      // 2. ⚡ DER TRICK: Wir löschen die ID explizit, damit 'newNote.id' falsy/leer ist!
      delete newNote.id; 
      
      const currentList: Note[] = [];

      service.createNote(newNote, currentList).subscribe((savedNote: Note) => {
        // Jetzt greift 'if (!newNote.id)' im Service und vergibt das 'tmp_'-Präfix!
        expect(savedNote.id).toContain('tmp_');
        expect(savedNote.title).toBe('Neuer Zettel');

        const backup = JSON.parse(localStorage.getItem('global_notes_pool')!);
        expect(backup.length).toBe(1);
        expect(backup[0].id).toContain('tmp_');
      });
    });

    it('sollte online die Notiz zum Server schicken und den Cache mit Serverdaten füllen', () => {
      const newNote = createTestNote({ title: 'Neuer Online-Zettel' });
      const currentList: Note[] = [];

      service.createNote(newNote, currentList).subscribe((savedNote: Note) => {
        expect(savedNote.id).toBe('server-id-99');
        expect(mockNoteRepository.createNote).toHaveBeenCalled();

        const backup = JSON.parse(localStorage.getItem('global_notes_pool')!);
        expect(backup[0].id).toBe('server-id-99');
      });
    });
  });

describe('updateNote (Notiz aktualisieren)', () => {
    it('sollte optimistisch den Cache aktualisieren und online an den Server senden', () => {
      const initialNote = createTestNote({ id: 'zettel-1', title: 'Alt' });
      const updatedNote = createTestNote({ id: 'zettel-1', title: 'Neu' });
      const currentList = [initialNote];

      // 1. Wir erstellen ein RxJS Subject, das wir manuell steuern können
      const serverResponseSubject = new Subject<Note>();
      
      // 2. Das Repository gibt dieses Subject zurück (der Server-Call "hängt" jetzt in der Leitung)
      mockNoteRepository.updateNote.mockReturnValueOnce(serverResponseSubject.asObservable());

      // 3. Aufruf starten
      service.updateNote(updatedNote, currentList).subscribe((savedNote: Note) => {
        // Erst wenn das Subject feuert, läuft dieser Block!
        expect(savedNote.title).toBe('Updated on Server');
        
        // Und erst jetzt steht die Server-Antwort im Cache
        const backup = JSON.parse(localStorage.getItem('global_notes_pool')!);
        expect(backup[0].title).toBe('Updated on Server');
      });

      // 🟢 BEWEIS FÜR OPTIMISTIC CACHING:
      // Das Subject hat noch nicht gefeuert (Server arbeitet noch).
      // Trotzdem MUSS der Cache bereits optimistisch aktualisiert worden sein!
      const intermediateBackup = JSON.parse(localStorage.getItem('global_notes_pool')!);
      expect(intermediateBackup[0].title).toBe('Neu');

      // 4. Jetzt simulieren wir die erfolgreiche Antwort des Servers!
      serverResponseSubject.next(createTestNote({ ...updatedNote, title: 'Updated on Server' }));
      serverResponseSubject.complete();
    });

    it('sollte bei einer temporären ID (offline erstellt) nicht versuchen, den Server zu kontaktieren', () => {
      const tmpNote = createTestNote({ id: 'tmp_123', title: 'Geändert' });
      const currentList = [tmpNote];

      service.updateNote(tmpNote, currentList).subscribe((savedNote: Note) => {
        expect(mockNoteRepository.updateNote).not.toHaveBeenCalled();
      });
    });
  });
  
  describe('deleteNote (Notiz pflegen / löschen)', () => {
    it('sollte die Notiz sofort optimistisch aus dem Cache löschen und online den Server-Call absetzen', () => {
      const noteToDelete = createTestNote({ id: 'zettel-to-kill', title: 'Kill Me' });
      const currentList = [noteToDelete];

      service.deleteNote('zettel-to-kill', 'user-1', currentList).subscribe(() => {
        expect(mockNoteRepository.deleteNote).toHaveBeenCalledWith('zettel-to-kill', 'user-1');
      });

      const backup = JSON.parse(localStorage.getItem('global_notes_pool')!);
      expect(backup.length).toBe(0);
    });

    it('sollte bei einer temporären ID nur lokal löschen und keinen Server-Call absetzen', () => {
      const tmpNote = createTestNote({ id: 'tmp_999', title: 'Offline-Leiche' });
      const currentList = [tmpNote];

      service.deleteNote('tmp_999', 'user-1', currentList).subscribe(() => {
        expect(mockNoteRepository.deleteNote).not.toHaveBeenCalled();
      });

      const backup = JSON.parse(localStorage.getItem('global_notes_pool')!);
      expect(backup.length).toBe(0);
    });
  });
});