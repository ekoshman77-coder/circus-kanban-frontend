import { Note } from "../../models/note";
import { INoteJson } from "../../repositories/dto/note-json";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";
import {
  NotePayload,
  NoteActionPayload,
  NoteStatusChangePayload,
  NoteQueueAction
} from "../../models/queue-items/note-queue-payload";

export class NoteStateProvider extends ArrayStateProvider<Note> {
  protected override storageKey: string = 'global_notes_pool';
;
  constructor() {
    super([]);
  }

  public loadFromCache(): void {
    const cached = this.localStorageService.getItem(this.storageKey);
    if (cached && Array.isArray(cached)) {
      const restored = cached.map((json: INoteJson) => Note.fromJson(json));
      this.setRawState(restored);
    }
  }

  // 🚀 Die zentrale Schaltstelle für alle State-Aktionen
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as NoteQueueAction) {
      case 'SET_NOTES': {
        const notes = payload as Note[];
        this.setRawState(notes);
        break;
      }
      case 'CREATE': {
        const createPayload = payload as NotePayload;
        this.addOrUpdateItem(createPayload.note);
        break;
      }
      case 'UPDATE': {
        const updatePayload = payload as NotePayload;
        this.addOrUpdateItem(updatePayload.note);
        break;
      }
      case 'DELETE': {
        const deletePayload = payload as NoteActionPayload;
        this.removeItemById(deletePayload.id);
        break;
      }
      case 'STATUS_CHANGE': {
        const statusPayload = payload as NoteStatusChangePayload;
        this.applyAction((notes) =>
          notes.map((n) =>
            n.id === statusPayload.id
              ? new Note({ ...n, isInCalculation: statusPayload.isInCalculation })
              : n
          )
        );
        break;
      }
      case 'PROMOTE':
      case 'REVERT': {
        // Status-/Scope-Änderungen optimistisch im State abbilden (falls gewünscht)
        break;
      }
    }
  }

    public override restoreFromSnapshot(snapshot: unknown): void {
        const newState = (snapshot as INoteJson[]).map(note => Note.fromJson(note))
        this.setRawState(newState)
    }
}