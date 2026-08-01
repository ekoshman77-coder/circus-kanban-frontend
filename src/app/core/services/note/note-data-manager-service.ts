import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Note } from '../../models/note';
import { ConnectionService } from '../connection/connection-service';
import { NoteRepository } from '../../repositories/note-repository';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

/**
 * Service für das offline-sichere und optimistische Datenmanagement von Notizen/Zetteln.
 * * **Architektur-Highlight (Optimistic Caching & Offline-First):**
 * - Verwaltet einen globalen Notizen-Pool im `LocalStorage` als schnelles Fallback-Backup.
 * - Im Offline-Modus werden Operationen lokal ausgeführt und Notizen mit temporären IDs (`tmp_`) markiert.
 * - Schreibende und löschende Aktionen aktualisieren den lokalen Cache *sofort synchron*,
 *   wodurch die App für den Nutzer extrem reaktionsschnell wirkt (Zero-Latency UI).
 */
@Injectable({
  providedIn: 'root'
})
export class NoteDataManagerService extends BaseDataManager {
  private noteRepository = inject(NoteRepository);
  private connectionService = inject(ConnectionService);

  /** Einheitlicher Key für den permanenten Notizen-Cache im LocalStorage */
  private readonly STORAGE_KEY = 'global_notes_pool';

  /** Speichert das übergebene Notizen-Array im lokalen Cache. */
  private saveToLocalStorage(notes: Note[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
  }

  /** Holt die Notizen aus dem lokalen Cache und rekonstruiert die Klassen-Instanzen. */
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
   * Lädt alle Notizen eines Benutzers. Weicht bei Offline-Zustand oder Serverfehlern
   * vollautomatisch auf den lokalen Cache aus.
   * @param userId Die ID des Benutzers.
   * @returns Ein Observable mit dem Array der Notizen.
   */
  public getNotes(userId: string): Observable<Note[]> {
    if (this.connectionService.status() === 'OFFLINE') {
      return of(this.getFromLocalStorage());
    }

    return this.noteRepository.getNotesByUserId(userId).pipe(
      map(serverNotes => {
        this.saveToLocalStorage(serverNotes); // Lokales Backup synchronisieren
        return serverNotes;
      }),
      catchError(err => {
        console.error('Fehler beim Online-Laden der Zettel, weiche auf Cache aus', err);
        return of(this.getFromLocalStorage());
      })
    );
  }

  /**
   * Erstellt eine neue Notiz. Vergibt im Offline-Modus eine temporäre ID.
   * Aktualisiert den lokalen Cache sofort.
   * @param newNote Die neu zu erstellende Notiz.
   * @param actualList Die aktuell im UI gerenderte Liste von Notizen.
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
   * Aktualisiert eine bestehende Notiz. Schreibt die Änderung für maximale gefühlte
   * Geschwindigkeit sofort in den Cache, bevor die Serverantwort eintrifft (Optimistic).
   * @param updatedNote Die bearbeitete Notiz.
   * @param actualList Die aktuell im UI gerenderte Liste von Notizen.
   */
  public updateNote(updatedNote: Note, actualList: Note[]): Observable<Note> {
    const aktualisierteListe = actualList.map(n => n.id === updatedNote.id ? updatedNote : n);
    this.saveToLocalStorage(aktualisierteListe);

    if (this.connectionService.status() === 'OFFLINE' || updatedNote.id?.startsWith('tmp_')) {
      return of(updatedNote);
    }

    return this.noteRepository.updateNote(updatedNote.id!, updatedNote).pipe(
      map(savedNote => {
        // Zustand nachträglich mit finaler Serverantwort synchronisieren
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
   * Löscht eine Notiz. Entfernt sie für verzögerungsfreie UI sofort aus dem Cache.
   * @param id Die ID der zu löschenden Notiz.
   * @param userId Die ID des Benutzers.
   * @param actualList Die aktuell im UI gerenderte Liste von Notizen.
   */
  public deleteNote(id: string, userId: string, actualList: Note[]): Observable<void> {
    const gefilterteListe = actualList.filter(n => n.id !== id);
    this.saveToLocalStorage(gefilterteListe);

    if (this.connectionService.status() === 'OFFLINE' || id.startsWith('tmp_')) {
      return of(undefined);
    }

    return this.noteRepository.deleteNote(id, userId);
  }

  public override resetData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🧼 [NoteDataManager] Globaler Ideen-Pool wurde gelöscht.');
  }

  public override checkUnsavedData(): string | null {
    return null; // Hier gibt es nichts zu blockieren
  }
}