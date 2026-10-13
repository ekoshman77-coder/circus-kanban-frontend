import { TestBed } from '@angular/core/testing';
import { NoteDataManagerService } from './note-data-manager-service';
import { ConnectionService } from '../connection/connection-service';
import { NoteRepository } from '../../repositories/note-repository';
import { CentralQueueService } from '../central-queue/central-queue-service';
import { Note } from '../../models/note';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { QueueHandlerName } from '../../enums/queue-handler-name';

describe('NoteDataManagerService', () => {
  let service: NoteDataManagerService;

  // Typsichere Mocks
  let mockNoteRepository: Partial< NoteRepository >;
  let mockConnectionService: Partial< ConnectionService >;
  let mockQueueService: Partial< CentralQueueService >;

  // LocalStorage Mock Store
  let store: Record< string, string > = {};

  interface NoteInitParams {
    title: string;
    content: string;
    colorType: string;
    userId: string;
    tag?: string | null;
    id?: string;
    isInCalculation?: boolean;
    temperature?: number | null;
    weatherCode?: number | null;
  }

  const createTestNote = (overrides: Partial< NoteInitParams > = {}): Note => {
    return new Note({
      id: overrides.id ?? 'note-123',
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

    mockConnectionService = {
      isOffline: signal< boolean >(false),
      isOnline: signal< boolean >(true)
    };

    mockNoteRepository = {
      getNotesByUserId: vi.fn().mockReturnValue(of([createTestNote({ id: '1', title: 'Server Note' })])),
      createNote: vi.fn().mockImplementation((note) => of(createTestNote({ ...note, id: 'server-id-99' }))),
      updateNote: vi.fn().mockImplementation((note) => of(createTestNote({ ...note, title: 'Updated on Server' }))),
      deleteNote: vi.fn().mockReturnValue(of(undefined))
    };

    mockQueueService = {
      enqueue: vi.fn(),
      registerService: vi.fn(),
      updateEntityIdInQueue: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        NoteDataManagerService,
        { provide: ConnectionService, useValue: mockConnectionService },
        { provide: NoteRepository, useValue: mockNoteRepository },
        { provide: CentralQueueService, useValue: mockQueueService }
      ]
    });

    service = TestBed.inject(NoteDataManagerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('Signal & Reactive State', () => {
    it('sollte das notesSignal initial als Array bereitstellen', () => {
      expect(service.notesSignal()).toBeDefined();
      expect(Array.isArray(service.notesSignal())).toBe(true);
    });
  });

  describe('createNote (Notiz erstellen)', () => {
    it('sollte die Notiz im State verarbeiten und in die Queue reihen', () => {
      const newNote = createTestNote({ id: 'tmp_1', title: 'Neuer Zettel' });

      service.createNote(newNote);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.NOTE,
        'CREATE',
        expect.objectContaining({
          id: 'tmp_1',
          note: newNote,
          displayInfo: {
            category: 'Notiz erzeugen',
            title: 'Neuer Zettel'
          }
        })
      );
    });
  });

  describe('updateNote (Notiz aktualisieren)', () => {
    it('sollte bei einer Standard-Aktualisierung eine UPDATE Action enqueuen', () => {
      const updatedNote = createTestNote({ id: 'zettel-1', title: 'Neu' });

      service.updateNote(updatedNote);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.NOTE,
        'UPDATE',
        expect.objectContaining({
          id: 'zettel-1',
          note: updatedNote,
          displayInfo: {
            category: 'Notiz bearbeiten',
            title: 'Neu'
          }
        })
      );
    });

    it('sollte bei updateAction "promote" eine PROMOTE Action enqueuen', () => {
      const note = createTestNote({ id: 'zettel-1', title: 'Promote Me' });

      service.updateNote(note, 'promote');

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.NOTE,
        'PROMOTE',
        expect.objectContaining({
          id: 'zettel-1',
          displayInfo: {
            category: 'Notiz befördern',
            title: 'Promote Me'
          }
        })
      );
    });

    it('sollte bei updateAction "status_change" eine STATUS_CHANGE Action enqueuen', () => {
      const note = createTestNote({ id: 'zettel-1', isInCalculation: true });

      service.updateNote(note, 'status_change');

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.NOTE,
        'STATUS_CHANGE',
        expect.objectContaining({
          id: 'zettel-1',
          isInCalculation: true,
          displayInfo: {
            category: 'Notiz-Status ändern',
            title: 'Standard Title'
          }
        })
      );
    });
  });

  describe('deleteNote (Notiz löschen)', () => {
    it('sollte eine DELETE Action für die übergebene ID enqueuen', () => {
      service.deleteNote('zettel-to-kill');

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        QueueHandlerName.NOTE,
        'DELETE',
        expect.objectContaining({
          id: 'zettel-to-kill',
          displayInfo: {
            category: 'Notiz löschen',
            title: 'Unbenannte Notiz'
          }
        })
      );
    });
  });
});