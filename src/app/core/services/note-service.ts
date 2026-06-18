import { inject, Injectable, signal, computed } from '@angular/core';
import { Note } from '../models/note';
import { NoteDataManagerService } from './note-data-mananger-service';
import { UserService } from './user/user-service';
@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private dataManager = inject(NoteDataManagerService);
  private userService = inject(UserService);

  // 🌟 Der Zustand an der Tafel
  private notesSignal = signal<Note[]>([]);
  public readonly notesList = this.notesSignal.asReadonly();

  private readonly DRAFT_KEY = 'draft_note';

  /** 📝 Sichert den aktuellen Entwurf im LocalStorage */
  public saveDraft(noteData: any): void {
    localStorage.setItem(this.DRAFT_KEY, JSON.stringify(noteData));
  }

  /** 🔍 Holt den gespeicherten Entwurf ab (falls vorhanden) */
  public getDraft(): any | null {
    const draft = localStorage.getItem(this.DRAFT_KEY);
    return draft ? JSON.parse(draft) : null;
  }

  /** 🗑️ Löscht den Entwurf nach erfolgreichem Absenden */
  public clearDraft(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }

  // Automatisch ermittelte User-ID aus deinem UserService-Signal
  private get currentUserId(): string {
    const user = this.userService.currentUser();
    if (!user) throw new Error('Kein Benutzer angemeldet!');
    return user.id;
  }

  /**
   * 1. Alle Zettel für den aktuellen User laden
   */
  public loadNotes(): void {
    try {
      const userId = this.currentUserId;
      this.dataManager.getNotes(userId).subscribe({
        next: (notes) => this.notesSignal.set(notes),
        error: (err) => console.error('Fehler im NoteService beim Laden:', err)
      });
    } catch (e) {
      console.warn('Zettel konnten nicht geladen werden, da kein User eingeloggt ist.');
    }
  }

  /**
   * 2. Neuen Zettel hinzufügen (Farbe, Titel, Beschreibung)
   */
  public addNote(input: {
    title: string,
    content: string,
    colorType: string,
    tag?: string | null
  }): void {
    const activeUser = this.userService.currentUser();
    if (!activeUser) {
      return;
    }

    const newNote: Note = {
      userId: activeUser!.id, // 👤 Wird hier automatisch injiziert!
      title: input.title,
      content: input.content,
      colorType: input.colorType,
      tag: input.tag ?? "",
      isInCalculation: false
    };

    this.dataManager.createNote(newNote).subscribe({
      next: (savedNote) => {
        this.notesSignal.update(notes => [...notes, savedNote]);
      }
    });
  }

  /**
   * 3. Zettel verändern (Titel/Inhalt editiert oder per Drag&Drop verschoben)
   */
  /**
     * 3. Zettel verändern (Jetzt mit sofortigem Signal-Turbo!)
     */
  public updateNote(updatedNote: Note): void {
    console.log('⚡ LOG 2 :: NoteService empfängt Update für:', updatedNote.title, 'Flag:', updatedNote.isInCalculation);

    this.notesSignal.update(notes => {
      const neueListe = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
      console.log('📊 LOG 3 :: Signal-Array wurde aktualisiert. Neue Liste:', neueListe);
      return neueListe;
    });

    this.dataManager.updateNote(updatedNote).subscribe({
      next: (savedFromServer) => {
        console.log('✅ LOG 4 :: Server/DataManager hat das Update bestätigt:', savedFromServer);
      },
      error: (err) => console.error('❌ Fehler beim Speichern:', err)
    });
  }
  /**
   * 4. Zettel von der Wand reißen
   */
  public removeNote(id: string): void {
    console.log("NoteService:: removeNote")
    const userId = this.currentUserId;
    this.dataManager.deleteNote(id, userId).subscribe({
      next: () => {
        this.notesSignal.update(notes => notes.filter(n => n.id !== id));
      }
    });
  }
}