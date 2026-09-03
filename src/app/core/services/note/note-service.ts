import { inject, Injectable, signal, computed, effect } from '@angular/core';
import { Note } from '../../models/note';
import { NoteDataManagerService } from './note-data-manager-service';
import { UserService } from '../user/user-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { MasterDataService } from '../admin/master-data-service';

export type NoteUpdateOption = 'update' | 'promote' | 'revert' | 'status_change' 
/**
 * Zentraler State-Service zur Verwaltung und Bereitstellung aller Benutzer-Notizen.
 * * **Architektur-Highlight (Doppelt-Optimistischer State-Sicherheitsgurt):**
 * - Verwaltet den UI-Zustand reaktiv über ein Read-Only Signal (`notesList`).
 * - Aktualisiert das Signal bei Änderungen (Update, Delete) *sofort synchron*, bevor die API kontaktiert wird.
 * - Falls das Backend fehlschlägt, wird der Zustand vollautomatisch und unbemerkt auf die alte Liste zurückgerollt (Rollback-Sicherheit).
 * - Beinhaltet ein lokales Draft-System zur Wiederherstellung unvollendeter Zettel-Entwürfe.
 */
@Injectable({
  providedIn: 'root'
})
export class NoteService extends BaseDataManager {
  private dataManager = inject(NoteDataManagerService);
  private userService = inject(UserService);
  private masterDataService = inject(MasterDataService);

  /** Zentraler, interner Zustand aller Notizen */
  private notesSignal = signal<Note[]>([]);

  /** Read-Only Signal für UI-Komponenten zur reaktiven Bindung */
  public readonly notesList = this.notesSignal.asReadonly();

  private readonly DRAFT_KEY = 'draft_note';

  constructor() {
    super()

    // REAKTIVER EFFEKT: Lädt Notizen automatisch bei Login oder leert sie bei Logout
    effect(() => {
      if (this.userService.currentUser()) {
        this.loadNotes();
      } else {
        this.notesSignal.set([]);
      }
    });
  }

  // Dynamisch filtern anhand der MasterData-Scopes
  public readonly departmentNotes = computed(() => {
    return this.notesList().filter(n => n.scope === 'DEPARTMENT');
  });

  public readonly companyNotes = computed(() => {
    return this.notesList().filter(n => n.scope === 'COMPANY');
  });

  /** Speichert einen Zettel-Entwurf im LocalStorage. */
  public saveDraft(noteData: any): void {
    localStorage.setItem(this.DRAFT_KEY, JSON.stringify(noteData));
  }

  /** Holt den gespeicherten Zettel-Entwurf aus dem LocalStorage. */
  public getDraft(): any | null {
    const draft = localStorage.getItem(this.DRAFT_KEY);
    return draft ? JSON.parse(draft) : null;
  }

  /** Löscht den Entwurf aus dem Speicher. */
  public clearDraft(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }

  /** Helfer zur Ermittlung der aktuellen User-ID. Wirft Fehler, falls kein User da ist. */
  private get currentUserId(): string {
    const user = this.userService.currentUser();
    if (!user) throw new Error('Kein Benutzer angemeldet!');
    return user.id;
  }

  /**
   * Lädt alle Zettel für den aktuell angemeldeten Benutzer aus dem DataManager.
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
   * Erstellt eine neue Notiz und fügt sie dem Zustand hinzu.
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

    const newNote = new Note({
      userId: activeUser.id,
      departmentId: this.userService.currentUser()?.department?.id?? "",
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
   * Aktualisiert eine Notiz optimistisch im Signal.
   * Führt bei Serverfehlern einen automatischen Rollback durch
   */
  public updateNote(updatedNote: Note, updateAction?: NoteUpdateOption): void {
    console.log("NoteService", updatedNote)
    const alteListe = this.notesSignal();

    // Optimistisches UI-Update: Zustand wird sofort im Signal gerendert
    this.notesSignal.update(notes => notes.map(n => n.id === updatedNote.id ? updatedNote : n));

    this.dataManager.updateNote(updatedNote, alteListe, updateAction).subscribe({
      next: (savedFromServer) => {
        console.log("NoteDataManager savedFromServer", savedFromServer)
        // Zustand mit endgültigen Serverwerten überschreiben (z.B. neu generierte IDs/Metadaten)
        this.notesSignal.update(notes => notes.map(n => n.id === updatedNote.id ? savedFromServer : n));
      },
      error: (err) => {
        console.error('❌ Fehler beim Speichern, rollBack auf alten Zustand:', err);
        // Rollback bei Fehler!
        this.notesSignal.set(alteListe);
      }
    });
  }

  /**
   * Löscht eine Notiz optimistisch im Signal und stößt das API-Löschen an.
   * Führt bei Serverfehlern einen automatischen Rollback durch.
   */
  public removeNote(id: string): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    const alteListe = this.notesSignal();

    // Optimistisches UI-Update: Sofort im Signal weglöschen
    this.notesSignal.update(notes => notes.filter(n => n.id !== id));

    this.dataManager.deleteNote(id, userId, alteListe).subscribe({
      error: (err) => {
        console.error('Fehler beim Löschen, stelle Liste wieder her:', err);
        // Rollback bei Fehler!
        this.notesSignal.set(alteListe);
      }
    });
  }

  /**
   * Ändert den Berechnungs-Status einer Notiz (Aktivierung für RPG-XP-Berechnungen oder KI)
   */
  public updateNoteStatus(noteId: string, inCalculation: boolean): void {
    const note = this.notesSignal().find(n => n.id === noteId);
    if (!note) {
      return;
    }

    const updatedNote = new Note({
      ...note,
      isInCalculation: inCalculation
    })

    this.updateNote(updatedNote, 'status_change');
  }

  public override checkUnsavedData(): string | null {
    const pendingQueue = localStorage.getItem(this.DRAFT_KEY);
    if (pendingQueue) {
      return `Es gibt noch ungespeicherte Idee-Änderungen .`;
    }
    return null;
  }

  public override resetData(): void {
    this.clearDraft()
  }

  /**
   * 🟢 Hebt eine Idee auf 'COMPANY'-Scope
   */
  public promoteToCompany(noteId: string): void {
    const note = this.notesSignal().find(n => n.id === noteId);
    if (!note) return;

    const updatedNote = new Note({
      ...note,
      scope: 'COMPANY'
    });

    this.updateNote(updatedNote, 'promote');
  }

  /**
   * 🟢 Stuft eine Idee zurück auf 'DEPARTMENT'-Scope
   */
  public revertToDepartment(noteId: string): void {
    const note = this.notesSignal().find(n => n.id === noteId);
    if (!note) return;

    const updatedNote = new Note({
      ...note,
      scope: 'DEPARTMENT'
    });

    this.updateNote(updatedNote, 'revert');
  }
}