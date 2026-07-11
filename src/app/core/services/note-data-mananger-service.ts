import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
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

  // Einheitlicher Key für den permanenten Notizen-Cache
  private readonly STORAGE_KEY = 'global_notes_pool';

  private saveToLocalStorage(notes: Note[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
  }

  private getFromLocalStorage(): Note[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return [];
    try {
      const rawArray: any[] = JSON.parse(data);
      return rawArray.map(json => new Note(json));
    } catch (e) {
      console.error('Fehler beim Dekodieren des local_notes_pool:', e);
      return [];
    }
  }

  /**
   * 🔍 ZETTEL LADEN (Stateless Pipeline)
   */
  public getNotes(userId: string): Observable<Note[]> {
    if (this.connectionService.status() === 'OFFLINE') {
      console.log('📶 [Note-DataManager] Offline-Modus: Lade Zettel aus dem Cache');
      return of(this.getFromLocalStorage());
    }

    return this.noteRepository.getNotesByUserId(userId).pipe(
      map(serverNotes => {
        this.saveToLocalStorage(serverNotes); // Lokales Backup auffrischen
        return serverNotes;
      }),
      catchError(err => {
        console.error('Fehler beim Online-Laden der Zettel, weiche auf Cache aus', err);
        return of(this.getFromLocalStorage());
      })
    );
  }

  /**
   * ➕ ZETTEL ERSTELLEN (Mit actualList!)
   */
  public createNote(newNote: Note, actualList: Note[]): Observable<Note> {
    if (this.connectionService.status() === 'OFFLINE') {
      if (!newNote.id) newNote.id = 'tmp_' + Date.now();
      const aktualisierteListe = [...actualList, newNote];
      this.saveToLocalStorage(aktualisierteListe);
      return of(newNote);
    }

    return this.noteRepository.createNote(newNote).pipe(
      map(savedNote => {
        const aktualisierteListe = [...actualList, savedNote];
        this.saveToLocalStorage(aktualisierteListe);
        return savedNote;
      })
    );
  }

  /**
   * ✏️ ZETTEL AKTUALISIEREN (Mit actualList!)
   */
  public updateNote(updatedNote: Note, actualList: Note[]): Observable<Note> {
    const aktualisierteListe = actualList.map(n => n.id === updatedNote.id ? updatedNote : n);
    this.saveToLocalStorage(aktualisierteListe);

    if (this.connectionService.status() === 'OFFLINE' || updatedNote.id?.startsWith('tmp_')) {
      return of(updatedNote);
    }

    return this.noteRepository.updateNote(updatedNote.id!, updatedNote).pipe(
      map(savedNote => {
        // Zustand mit Serverantwort synchronisieren
        const synchedList = actualList.map(n => n.id === updatedNote.id ? savedNote : n);
        this.saveToLocalStorage(synchedList);
        return savedNote;
      }),
      catchError(err => {
        console.warn('Zettel-Update konnte nicht an Server gesendet werden (wird offline gehalten):', err);
        return of(updatedNote);
      })
    );
  }

  /**
   * 🗑️ ZETTEL LÖSCHEN (Mit actualList!)
   */
  public deleteNote(id: string, userId: string, actualList: Note[]): Observable<void> {
    const gefilterteListe = actualList.filter(n => n.id !== id);
    this.saveToLocalStorage(gefilterteListe);

    if (this.connectionService.status() === 'OFFLINE' || id.startsWith('tmp_')) {
      return of(undefined);
    }

    return this.noteRepository.deleteNote(id, userId);
  }
}