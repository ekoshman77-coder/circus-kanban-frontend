import { Note } from "../../models/note";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";
import {
  NotePayload,
  NoteActionPayload,
  NoteStatusChangePayload,
  NoteQueueAction
} from "../../models/queue-items/note-queue-payload";

export class NoteStateProvider extends ArrayStateProvider< Note > {
  protected override storageKey: string = 'global_notes_pool';

  // 🎯 Registriert Note für automatische Snapshot/Cache-Deserialisierung
  protected modelStatic = Note;

  constructor() {
    super([]);
  }

  // 🚀 Die zentrale Schaltstelle für alle State-Aktionen
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as NoteQueueAction) {
      case 'SET_NOTES': {
        const notes = Array.isArray(payload)
          ? payload.map((n: any) => n instanceof Note ? n : Note.fromJson(n))
          : [];
        this.setRawState(notes);
        break;
      }
      case 'CREATE':
      case 'UPDATE': {
        const notePayload = payload as NotePayload;
        if (notePayload?.note) {
          const noteInstance = notePayload.note instanceof Note 
            ? notePayload.note 
            : Note.fromJson(notePayload.note);
          this.addOrUpdateItem(noteInstance);
        }
        break;
      }
      case 'DELETE': {
        const deletePayload = payload as NoteActionPayload;
        if (deletePayload?.id) {
          this.removeItemById(deletePayload.id);
        }
        break;
      }
      case 'STATUS_CHANGE': {
        const statusPayload = payload as NoteStatusChangePayload;
        if (statusPayload?.id) {
          this.applyAction((notes) =>
            notes.map((n) =>
              n.id === statusPayload.id
                ? n.cloneWith({ isInCalculation: statusPayload.isInCalculation })
                : n
            )
          );
        }
        break;
      }
      case 'PROMOTE':
      case 'REVERT': {
        break;
      }
    }
  }
}