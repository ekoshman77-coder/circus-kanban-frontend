import { effect, inject, Injectable } from "@angular/core";
import { UserService } from "../user/user-service";
import { NoteService } from "./note-service";
import { NoteSortOrder } from "../../models/note-sort-order";

@Injectable({
  providedIn: 'root'
})
export class IdeaSortingService {
  private userService = inject(UserService);
  private noteService = inject(NoteService);
  private readonly BASE_STORAGE_KEY = 'my_note_sorting';

  constructor() {
    effect(() => {
      const user = this.userService.currentUser();
      if (user && user.id) {
        this.noteService.loadNotes();
      }
    });
  }

  /**
   * Lädt die Sortierung für einen bestimmten Kontext (Board-Modus)
   */
  public loadSorting(contextKey: string): NoteSortOrder[] {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return [];
    
    try {
      const key = `${this.BASE_STORAGE_KEY}_${userId}_${contextKey}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Speichert die Sortierung für einen bestimmten Kontext
   */
  public saveSorting(contextKey: string, orders: NoteSortOrder[]): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;
    
    const key = `${this.BASE_STORAGE_KEY}_${userId}_${contextKey}`;
    localStorage.setItem(key, JSON.stringify(orders));
  }
}