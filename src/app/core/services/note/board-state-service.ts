import { inject, Injectable, signal, computed, effect } from '@angular/core';
import { NoteSortOrder } from '../../models/note-sort-order';
import { UserService } from '../user/user-service';
import { NoteService } from './note-service'; // Pfad ggf. anpassen

@Injectable({
  providedIn: 'root'
})
export class IdeaSortingService {
  private userService = inject(UserService);
  private noteService = inject(NoteService); // 🌟 Wir injizieren den NoteService!
  
  private readonly BASE_STORAGE_KEY = 'my_note_sorting';

  private sortOrdersSignal = signal<NoteSortOrder[]>([]);
  public currentSortOrders = computed(() => this.sortOrdersSignal());

  constructor() {
    console.log('🚀 [BoardStateService] Constructor läuft. Warte reaktiv auf User...');

    // 🔐 DER ZENTRALE STARTKNOPF FÜR DIE GANZE APP
    effect(() => {
      const user = this.userService.currentUser();
      console.log('👤 [BoardStateService] User-Signal hat sich verändert:', user);

      if (user && user.id) {
        // DOMINOSTEIN 1: Sortierung aus dem LocalStorage fischen
        try {
          const key = `${this.BASE_STORAGE_KEY}_${user.id}`;
          const saved = localStorage.getItem(key);
          this.sortOrdersSignal.set(saved ? JSON.parse(saved) : []);
          console.log('📥 [BoardStateService] Sortierung aus LocalStorage geladen.');
        } catch (e) {
          this.sortOrdersSignal.set([]);
        }

        // DOMINOSTEIN 2: Dem NoteService den Befehl geben, die Notizen aus der DB zu laden!
        console.log('🛰️ [BoardStateService] Trigger: Rufe noteService.loadNotes() auf!');
        this.noteService.loadNotes(); 

      } else {
        // Falls kein User da ist, alles zurücksetzen
        this.sortOrdersSignal.set([]);
      }
    });
  }

  public saveSorting(orders: NoteSortOrder[]): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;
    this.sortOrdersSignal.set(orders);
    localStorage.setItem(`${this.BASE_STORAGE_KEY}_${userId}`, JSON.stringify(orders));
  }
}