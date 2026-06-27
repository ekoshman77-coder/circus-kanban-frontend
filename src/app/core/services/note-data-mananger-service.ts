import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Note } from '../models/note';
import { ConnectionService } from './connection-service';
import { NoteRepository } from '../repositories/note-repository';

@Injectable({
  providedIn: 'root'
})
export class NoteDataManagerService {
  private noteRepository = inject(NoteRepository);
  private connectionService = inject(ConnectionService);

  private readonly STORAGE_KEY_PREFIX = 'local_notes_';

  // Hilfsmethode für das lokale Backup
  private saveToLocalStorage(userId: string, notes: Note[]): void {
    localStorage.setItem(this.STORAGE_KEY_PREFIX + userId, JSON.stringify(notes));
  }

  private getFromLocalStorage(userId: string): Note[] {
    const data = localStorage.getItem(this.STORAGE_KEY_PREFIX + userId);
    return data ? JSON.parse(data) : [];
  }

  /**
   * 🔍 ZETTEL LADEN (Online vom Server + Offline Fallback)
   */
  public getNotes(userId: string): Observable<Note[]> {
    if (this.connectionService.status() === 'OFFLINE') {
      console.log('📶 [Note-DataManager] Offline-Modus: Lade Zettel aus dem LocalStorage');
      return of(this.getFromLocalStorage(userId));
    }

    return this.noteRepository.getNotesByUserId(userId).pipe(
      map(serverNotes => {
        this.saveToLocalStorage(userId, serverNotes); // Lokales Backup auffrischen
        return serverNotes;
      }),
      catchError(err => {
        console.error('Fehler beim Online-Laden der Zettel, weiche auf LocalStorage aus', err);
        return of(this.getFromLocalStorage(userId));
      })
    );
  }

  /**
   * ➕ ZETTEL ERSTELLEN
   */
  public createNote(newNote: Note): Observable<Note> {
    const userId = newNote.userId;
    const lokaleListe = this.getFromLocalStorage(userId);

    if (this.connectionService.status() === 'OFFLINE') {
      // Offline-Generierung einer temporären ID, falls noch keine da ist
      if (!newNote.id) newNote.id = 'tmp_' + Date.now();
      const aktualisierteListe = [...lokaleListe, newNote];
      this.saveToLocalStorage(userId, aktualisierteListe);
      return of(newNote);
    }

    return this.noteRepository.createNote(newNote).pipe(
      map(savedNote => {
        const aktualisierteListe = [...lokaleListe, savedNote];
        this.saveToLocalStorage(userId, aktualisierteListe);
        return savedNote;
      })
    );
  }

  /**
   * ✏️ ZETTEL AKTUALISIEREN
   */
  public updateNote(updatedNote: Note): Observable<Note> {
    console.log("DataManager:: UpdateNote", updatedNote)

    const userId = updatedNote.userId;
    const lokaleListe = this.getFromLocalStorage(userId);

    // Lokales Update im Array
    const aktualisierteListe = lokaleListe.map(n => n.id === updatedNote.id ? updatedNote : n);
    this.saveToLocalStorage(userId, aktualisierteListe);

    if (this.connectionService.status() === 'OFFLINE' || updatedNote.id?.startsWith('tmp_')) {
      // Wenn offline oder ein temporärer Offline-Zettel editiert wird, bleiben wir lokal
      return of(updatedNote);
    }

   console.log("DataManager:: UpdateNote for NoteRepository", updatedNote)
    return this.noteRepository.updateNote(updatedNote.id!, updatedNote).pipe(
      catchError(err => {
        console.warn('Zettel-Update konnte nicht an Server gesendet werden (wird offline gehalten):', err);
        return of(updatedNote); // Trotzdem Erfolg für die UI simulieren
      })
    );
  }

  /**
   * 🗑️ ZETTEL LÖSCHEN
   */
  public deleteNote(id: string, userId: string): Observable<void> {
    console.log("DataManager:: DeleteNote")
    const lokaleListe = this.getFromLocalStorage(userId);
    const gefilterteListe = lokaleListe.filter(n => n.id !== id);
    this.saveToLocalStorage(userId, gefilterteListe);

    if (this.connectionService.status() === 'OFFLINE' || id.startsWith('tmp_')) {
      return of(undefined);
    }

    return this.noteRepository.deleteNote(id);
  }
}