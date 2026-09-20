import { inject, Injectable, signal, computed, effect, Signal } from '@angular/core';
import { Note } from '../../models/note';
import { NoteDataManagerService } from './note-data-manager-service';
import { UserService } from '../user/user-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { MasterDataService } from '../admin/master-data-service';

export type NoteUpdateOption = 'update' | 'promote' | 'revert' | 'status_change';

@Injectable({
  providedIn: 'root'
})
export class NoteService extends BaseDataManager {
  private dataManager = inject(NoteDataManagerService);
  private userService = inject(UserService);
  private masterDataService = inject(MasterDataService);

  public readonly notesList = this.dataManager.notesSignal;

  private readonly DRAFT_KEY = 'draft_note';
  
// ==========================================
  // 📊 COMPUTED SIGNALS FOR VIEWS
  // ==========================================

  public readonly departmentNotes = computed(() => {
    return this.notesList().filter(n => n.scope === 'DEPARTMENT');
  });

  public readonly companyNotes = computed(() => {
    return this.notesList().filter(n => n.scope === 'COMPANY');
  });

  // ==========================================
  // 🚀 ACTIONS (Reichen nur an DataManager weiter)
  // ==========================================

  public addNote(input: {
    title: string,
    content: string,
    colorType: string,
    tag?: string | null,
    temperature?: number | null,
    weatherCode?: number | null
  }): void {
    const activeUser = this.userService.currentUser();
    if (!activeUser) return;

    const newNote = new Note({
      userId: activeUser.id,
      departmentId: activeUser.department?.id ?? "",
      title: input.title,
      content: input.content,
      colorType: input.colorType,
      tag: input.tag ?? "",
      isInCalculation: false,
      temperature: input.temperature ?? null,
      weatherCode: input.weatherCode ?? null
    });

    // 🟢 DataManager übernimmt Signal, LocalStorage & Queue
    this.dataManager.createNote(newNote);
  }

  public updateNote(updatedNote: Note, updateAction?: NoteUpdateOption): void {
    this.dataManager.updateNote(updatedNote, updateAction);
  }

  public removeNote(id: string): void {
    this.dataManager.deleteNote(id);
  }

  public updateNoteStatus(noteId: string, inCalculation: boolean): void {
    const note = this.notesList().find(n => n.id === noteId);
    if (!note) return;

    const updatedNote = new Note({
      ...note,
      isInCalculation: inCalculation
    });

    this.updateNote(updatedNote, 'status_change');
  }

  public promoteToCompany(noteId: string): void {
    const note = this.notesList().find(n => n.id === noteId);
    if (!note) return;

    const updatedNote = new Note({
      ...note,
      scope: 'COMPANY'
    });

    this.updateNote(updatedNote, 'promote');
  }

  public revertToDepartment(noteId: string): void {
    const note = this.notesList().find(n => n.id === noteId);
    if (!note) return;

    const updatedNote = new Note({
      ...note,
      scope: 'DEPARTMENT'
    });

    this.updateNote(updatedNote, 'revert');
  }

  // ==========================================
  // 📝 DRAFT HANDLING (UI-Level)
  // ==========================================

  public saveDraft(noteData: any): void {
    localStorage.setItem(this.DRAFT_KEY, JSON.stringify(noteData));
  }

  public getDraft(): any | null {
    const draft = localStorage.getItem(this.DRAFT_KEY);
    return draft ? JSON.parse(draft) : null;
  }

  public clearDraft(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }

  public override checkUnsavedData(): string | null {
    const pendingDraft = localStorage.getItem(this.DRAFT_KEY);
    if (pendingDraft) {
      return `Es gibt noch ungespeicherte Idee-Entwürfe.`;
    }
    return null;
  }

  public override resetData(): void {
    this.clearDraft();
  }
}