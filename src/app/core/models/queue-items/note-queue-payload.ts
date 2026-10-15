import { SnapshotPayload } from "./queue-item";
import { INoteJson } from "../../repositories/dto/note-json";
import { Note } from "../note";

export type NoteQueueAction = 'SET_NOTES' | 'CREATE' | 'UPDATE' | 'PROMOTE' | 'REVERT' | 'STATUS_CHANGE' | 'DELETE';

// 1. Gemeinsame Basis für alle Note-Payloads (Snapshot ist stets ITNoteJson[])
export interface NoteSnapshotPayload extends SnapshotPayload< INoteJson> {}

// 2. CREATE & UPDATE: Brauchen die vollständige Note-Instanz
export interface NotePayload extends NoteSnapshotPayload {
  note: Note;
}

// 3. DELETE, PROMOTE & REVERT: Brauchen nur die ID (id erbt es bereits aus SnapshotPayload)
export interface NoteActionPayload extends NoteSnapshotPayload {}

// 4. STATUS_CHANGE: Für NoteStatusChangeRequest (inCalculation Flag ändern)
export interface NoteStatusChangePayload extends NoteSnapshotPayload {
  isInCalculation: boolean;
}