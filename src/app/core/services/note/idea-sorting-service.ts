import { inject, Injectable, signal, computed, effect } from '@angular/core';
import { NoteSortOrder } from '../../models/note-sort-order';
import { UserService } from '../user/user-service';
import { NoteService } from './note-service';

/**
 * Service zur Verwaltung und dauerhaften Speicherung der benutzerdefinierten Notizen-Sortierung.
 * * **Architektur-Highlight (Reaktive Orchestrierung):**
 * - Nutzt einen Angular `effect()`, der als zentraler reaktiver "Startknopf" fungiert.
 * - Sobald ein Benutzer sich anmeldet, wird automatisch die benutzerspezifische Sortierung aus
 *   dem `LocalStorage` wiederhergestellt und direkt der nachgelagerte Ladevorgang der Notizen
 *   im `NoteService` angestoßen (Domino-Effekt).
 */
@Injectable({
  providedIn: 'root'
})
export class IdeaSortingService {
  private userService = inject(UserService);
  private noteService = inject(NoteService);
  
  private readonly BASE_STORAGE_KEY = 'my_note_sorting';

  /** Internes, beschreibbares Signal für die Sortierreihenfolgen */
  private sortOrdersSignal = signal<NoteSortOrder[]>([]);

  /** Read-Only Signal für Komponenten, um reaktiv auf Sortierungsänderungen zu lauschen */
  public currentSortOrders = computed(() => this.sortOrdersSignal());

  constructor() {
    // 🔐 REAKTIVER STARTKNOPF: Reagiert vollautomatisch auf Benutzerwechsel
    effect(() => {
      const user = this.userService.currentUser();

      if (user && user.id) {
        // DOMINOSTEIN 1: Sortierung aus dem LocalStorage laden
        try {
          const key = `${this.BASE_STORAGE_KEY}_${user.id}`;
          const saved = localStorage.getItem(key);
          this.sortOrdersSignal.set(saved ? JSON.parse(saved) : []);
        } catch (e) {
          this.sortOrdersSignal.set([]);
        }

        // DOMINOSTEIN 2: Dem NoteService den Befehl geben, die Notizen aus der DB zu laden
        this.noteService.loadNotes(); 

      } else {
        // Falls kein User eingeloggt ist, Zustand zurücksetzen
        this.sortOrdersSignal.set([]);
      }
    });
  }

  /**
   * Speichert eine neue Sortierreihenfolge dauerhaft im LocalStorage und aktualisiert das Signal.
   * @param orders Die neue Liste von Sortiereinstellungen.
   */
  public saveSorting(orders: NoteSortOrder[]): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;
    
    this.sortOrdersSignal.set(orders);
    localStorage.setItem(`${this.BASE_STORAGE_KEY}_${userId}`, JSON.stringify(orders));
  }
}