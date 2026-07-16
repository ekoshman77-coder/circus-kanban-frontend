import { inject, Injectable, signal, computed, effect } from '@angular/core';
import { Note } from '../../models/note';
import { NoteDataManagerService } from './note-data-mananger-service';
import { UserService } from '../user/user-service';

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private dataManager = inject(NoteDataManagerService);
  private userService = inject(UserService);

  // 🌟 Der zentrale Zustand an der Tafel (Der Notizen-Pool)
  private notesSignal = signal<Note[]>([]);
  public readonly notesList = this.notesSignal.asReadonly();

  private readonly DRAFT_KEY = 'draft_note';

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

  constructor() {
     effect(() => {
      if (this.userService.currentUser()) {
        this.loadNotes()
      } else{
        this.notesSignal.set([])
      }
     }) 
  }

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
   * 2. Neuen Zettel hinzufügen
   */
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

    // Erzeuge direkt eine saubere Instanz der Note-Klasse
    const newNote = new Note({
      userId: activeUser.id,
      title: input.title,
      content: input.content,
      colorType: input.colorType,
      tag: input.tag ?? "",
      isInCalculation: false,
      temperature: input.temperature ?? null,
      weatherCode: input.weatherCode ?? null
    });

    this.dataManager.createNote(newNote, this.notesSignal()).subscribe({
      next: (savedNote) => {
        this.notesSignal.update(notes => [...notes, savedNote]);
      }
    });
  }

  /**
   * 3. Zettel verändern (Mit Signal-Vorabaktualisierung für maximale Performance)
   */
  public updateNote(updatedNote: Note): void {
    const alteListe = this.notesSignal();

    // Optimistisches UI-Update
    this.notesSignal.update(notes => notes.map(n => n.id === updatedNote.id ? updatedNote : n));

    this.dataManager.updateNote(updatedNote, alteListe).subscribe({
      next: (savedFromServer) => {
        // Ersetze das optimistische Objekt mit dem finalen Serverstand (z.B. falls IDs oder DB-Werte miterzeugt wurden)
        this.notesSignal.update(notes => notes.map(n => n.id === updatedNote.id ? savedFromServer : n));
      },
      error: (err) => {
        console.error('❌ Fehler beim Speichern, rollBack auf alten Zustand:', err);
        this.notesSignal.set(alteListe);
      }
    });
  }

  /**
   * 4. Zettel löschen
   */
  public removeNote(id: string): void {
    const userId = this.userService.getCurrentUserId()
    if (!userId) return;

    const alteListe = this.notesSignal();
       
    // Optimistisches UI-Update
    this.notesSignal.update(notes => notes.filter(n => n.id !== id));
 
    this.dataManager.deleteNote(id, userId, alteListe).subscribe({
      error: (err) => {
        console.error('Fehler beim Löschen, stelle Liste wieder her:', err);
        this.notesSignal.set(alteListe);
      }
    });
  }

  /**
   * 5. Berechnungs-Status toggeln
   */
  public updateNoteStatus(noteId: string, inCalculation: boolean) {
    const note = this.notesSignal().find(n => n.id === noteId);
    if (!note) {
      console.warn(`Zettel mit ID ${noteId} wurde nicht gefunden.`);
      return;
    }

    const updatedNote = new Note({
      title: note.title,
      content: note.content,
      colorType: note.colorType,
      userId: note.userId,
      tag: note.tag,
      id: note.id,
      isInCalculation: inCalculation,
      temperature: note.temperature,
      weatherCode: note.weatherCode
    });

    this.updateNote(updatedNote);
  }
}