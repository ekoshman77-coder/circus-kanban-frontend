import { inject, Injectable, Signal } from '@angular/core';
import { Observable, throwError, map } from 'rxjs';
import { Note } from '../../models/note';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { NoteRepository } from '../../repositories/note-repository';
import { NoteUpdateOption } from './note-service';
import {
  NotePayload,
  NoteActionPayload,
  NoteStatusChangePayload,
  NoteSnapshotPayload,
  NoteQueueAction
} from '../../models/queue-items/note-queue-payload';
import { NoteStateProvider } from './note-state-provider';

@Injectable({
  providedIn: 'root'
})
export class NoteDataManagerService extends BaseQueueDataManager {
  private noteRepository = inject(NoteRepository);

  constructor() {
    super('NoteDataManagerService');
    (this.stateProvider as NoteStateProvider).loadFromCache();
  }

  protected override createStateProvider(): NoteStateProvider {
    return new NoteStateProvider();
  }

  public get notesSignal(): Signal<Note[]> {
    return this.getSignal() as Signal<Note[]>;
  }

  // ==========================================
  // 🚀 BASE QUEUE DATA MANAGER HOOKS
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as NoteQueueAction;
    const payload = item.payload as NoteSnapshotPayload;

    switch (action) {
      case 'CREATE': {
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
        return throwError(() => new Error(`[NoteDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    super.checkAndReplaceIds(item, localId, serverId);
    const payload = item.payload;
    if (payload && 'note' in payload && payload.note) {
      const notePayload = payload as NotePayload;
      if (notePayload.note.departmentId === localId) {
        notePayload.note.departmentId = serverId;
      }
    }
  }

  // ==========================================
  // 🔗 DEPENDENCY & CHAIN EXTRACTION
  // ==========================================

  public override extractEntityIds(item: QueueItem): string[] {
    const ids = super.extractEntityIds(item);

    const payload = item.payload;
    if (payload && 'note' in payload && payload.note) {
      const notePayload = payload as NotePayload;
      if (notePayload.note.departmentId) {
        ids.push(notePayload.note.departmentId);
      }
    }

    return ids;
  }

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.noteRepository.getNotesByUserId(userId).pipe(
      map((serverNotes: Note[]): void => {
        const notes = serverNotes.map((n) => Note.fromJson(n));
        this.stateProvider.applyActionPayload('SET_NOTES', notes);
      })
    );
  }

  // ==========================================
  // 📝 PUBLIC API METHODEN
  // ==========================================

  public createNote(newNote: Note): void {
    const snapshot = this.stateProvider.createSnapshot();

    const payload: NotePayload = {
      id: newNote.id,
      note: newNote,
      snapshot
    };

    this.stateProvider.applyActionPayload('CREATE', payload);
    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public updateNote(updatedNote: Note, updateAction?: NoteUpdateOption): void {
    const snapshot = this.stateProvider.createSnapshot();

    switch (updateAction) {
      case 'promote': {
        const payload: NoteActionPayload = { id: updatedNote.id, snapshot };
        this.stateProvider.applyActionPayload('PROMOTE', payload);
        this.queueService.enqueue(this.serviceName, 'PROMOTE', payload);
        return;
      }
      case 'revert': {
        const payload: NoteActionPayload = { id: updatedNote.id, snapshot };
        this.stateProvider.applyActionPayload('REVERT', payload);
        this.queueService.enqueue(this.serviceName, 'REVERT', payload);
        return;
      }
      case 'status_change': {
        const payload: NoteStatusChangePayload = {
          id: updatedNote.id,
          isInCalculation: updatedNote.isInCalculation ?? false,
          snapshot
        };
        this.stateProvider.applyActionPayload('STATUS_CHANGE', payload);
        this.queueService.enqueue(this.serviceName, 'STATUS_CHANGE', payload);
        return;
      }
      default: {
        const payload: NotePayload = {
          id: updatedNote.id,
          note: updatedNote,
          snapshot
        };
        this.stateProvider.applyActionPayload('UPDATE', payload);
        this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
        return;
      }
    }
  }

  public deleteNote(id: string): void {
    const snapshot = this.stateProvider.createSnapshot();

    const payload: NoteActionPayload = {
      id,
      snapshot
    };

    this.stateProvider.applyActionPayload('DELETE', payload);
    this.queueService.enqueue(this.serviceName, 'DELETE', payload);
  }

  public override resetData(): void {
    this.stateProvider.resetState();
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}