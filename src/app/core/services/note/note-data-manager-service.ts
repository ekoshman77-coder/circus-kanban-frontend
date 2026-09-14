import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, throwError, map } from 'rxjs';
import { Note } from '../../models/note';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { NoteRepository } from '../../repositories/note-repository';
import { NoteUpdateOption } from './note-service';
import {
  NotePayload,
  NoteActionPayload,
  NoteStatusChangePayload,
  NoteSnapshotPayload
} from '../../models/queue-items/note-queue-payload';
import { INoteJson } from '../../repositories/dto/note-json';

export type NoteQueueAction = 'CREATE' | 'UPDATE' | 'PROMOTE' | 'REVERT' | 'STATUS_CHANGE' | 'DELETE';

@Injectable({
  providedIn: 'root'
})
export class NoteDataManagerService extends BaseQueueDataManager {
  private noteRepository = inject(NoteRepository);

  /** 🟢 Single Source of Truth */
  public notesSignal = signal<Note[]>([]);
  private readonly STORAGE_KEY = 'global_notes_pool';

  constructor() {
    super('NoteDataManagerService');
    this.loadFromCache();
  }

  // ==========================================
  // 🚀 BASE QUEUE DATA MANAGER HOOKS
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as NoteQueueAction;
    const payload = item.payload as NoteSnapshotPayload;
    switch (action) {
      case 'CREATE': {
        // 🛡️ Security: Backend soll eigene ID erzeugen -> Local ID weglassen!
        const noteToSend = new Note({
          ...(payload as NotePayload).note,
          id: undefined
        });
        return this.noteRepository.createNote(noteToSend);
      }
      case 'UPDATE': {
        return this.noteRepository.updateNote((payload as NotePayload).note);
      }
      case 'PROMOTE': {
        return this.noteRepository.promoteNote(payload.id);
      }
      case 'REVERT': {
        return this.noteRepository.revertNote(payload.id);
      }
      case 'STATUS_CHANGE': {
        return this.noteRepository.changeStatus(payload.id, (payload as NoteStatusChangePayload).isInCalculation);
      }
      case 'DELETE': {
        return this.noteRepository.deleteNote(payload.id);
      }
      default:
        return throwError((): Error => new Error(`[NoteDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override resetState(snapshot: INoteJson[]): void {
    if (Array.isArray(snapshot)) {
      const restored = snapshot.map((json: INoteJson) => Note.fromJson(json));
      this.notesSignal.set(restored);
      this.saveToCache(restored);
    }
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    const realNote = Note.fromJson(response);
    const updated = this.notesSignal().map((n) => (n.id === tempId ? realNote : n));
    this.notesSignal.set(updated);
    this.saveToCache(updated);
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    const payload = item.payload;
    // Wenn die Notiz selbst ein CREATE ist, ändert sich ihre Haupt-ID ohnehin über item.payload.id.
    // Aber wir müssen prüfen, ob sie eine departmentId als Fremdschlüssel referenziert:
    if (payload && 'note' in payload && payload.note) {
      const notePayload = payload as NotePayload;
      if (notePayload.note.departmentId === localId) {
        notePayload.note.departmentId = serverId;
      }
    }
  }
  
  // ==========================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.noteRepository.getNotesByUserId(userId).pipe(
      map((serverNotes: Note[]): void => {
        this.notesSignal.set(serverNotes);
        this.saveToCache(serverNotes);
      })
    );
  }

  // ==========================================
  // 📝 PUBLIC API METHODEN (mit Listen-Snapshot!)
  // ==========================================

  public createNote(newNote: Note): void {
    const snapshot = this.getSnapshotJson();
    const updated = [...this.notesSignal(), newNote];

    this.notesSignal.set(updated);
    this.saveToCache(updated);

    const payload: NotePayload = {
      id: newNote.id,
      note: newNote,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public updateNote(updatedNote: Note, updateAction?: NoteUpdateOption): void {
    const snapshot = this.getSnapshotJson();
    const updated = this.notesSignal().map((n) => (n.id === updatedNote.id ? updatedNote : n));

    this.notesSignal.set(updated);
    this.saveToCache(updated);

    switch (updateAction) {
      case 'promote': {
        const payload: NoteActionPayload = { id: updatedNote.id, snapshot };
        this.queueService.enqueue(this.serviceName, 'PROMOTE', payload);
        return;
      }
      case 'revert': {
        const payload: NoteActionPayload = { id: updatedNote.id, snapshot };
        this.queueService.enqueue(this.serviceName, 'REVERT', payload);
        return;
      }
      case 'status_change': {
        const payload: NoteStatusChangePayload = {
          id: updatedNote.id,
          isInCalculation: updatedNote.isInCalculation ?? false,
          snapshot
        };
        this.queueService.enqueue(this.serviceName, 'STATUS_CHANGE', payload);
        return;
      }
      default: {
        // Standard UPDATE
        const payload: NotePayload = {
          id: updatedNote.id,
          note: updatedNote,
          snapshot
        };
        this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
        return;
      }
    }
  }

  public deleteNote(id: string): void {
    const snapshot = this.getSnapshotJson();
    const updated = this.notesSignal().filter((n) => n.id !== id);

    this.notesSignal.set(updated);
    this.saveToCache(updated);

    const payload: NoteActionPayload = {
      id,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE', payload);
  }

  // ==========================================
  // 🛠️ PRIVATE CACHE HELPER
  // ==========================================

  private getSnapshotJson(): INoteJson[] {
    return this.notesSignal().map((n) => n.toJson());
  }

  private saveToCache(notes: Note[]): void {
    const jsonArray = notes.map((n) => n.toJson());
    this.localStorageService.setItem(this.STORAGE_KEY, jsonArray);
  }

  private loadFromCache(): void {
    const cached = this.localStorageService.getItem(this.STORAGE_KEY);
    if (cached && Array.isArray(cached)) {
      const restored = cached.map((json) => Note.fromJson(json));
      this.notesSignal.set(restored);
    } else {
      this.notesSignal.set([]);
    }
  }

  public override resetData(): void {
    this.localStorageService.removeItem(this.STORAGE_KEY);
    this.notesSignal.set([]);
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}