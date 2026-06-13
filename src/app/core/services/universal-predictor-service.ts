import { inject, Injectable } from '@angular/core';
import { ConnectionService } from './connection-service';
import { AiRepository } from '../repositories/ai-repository';
import { firstValueFrom, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UniversalPredictorService {
  private aiRepository = inject(AiRepository);
  private connectionService = inject(ConnectionService);

  /**
   * 🌟 DER UNIVERSELLE HYBRID-DETEKTIV
   * Entscheidet blitzschnell zwischen Online (Server-KI) und Offline (Frontend-Zähler)
   */
public async predict(text: string, userId: string, contextType: 'todo' | 'note'): Promise<string> {
    if (!text || text.trim().length < 3) return '';

    // 🌐 Online-Pfad: Schickt die 3 Daten zum Server
    if (this.connectionService.status() === 'ONLINE') {
      try {
        const payload = { text, contextType, userId };
        return (await firstValueFrom(this.aiRepository.getServerPrediction(payload))).suggestedCategory;
      } catch (err) {
        console.warn('⚡ Server-KI zickt, wechsle reibungslos in den Offline-Modus...');
        return this.predictOffline(text, userId, contextType);
      }
    }

    // 🔌 Offline-Pfad: Holt sich die Daten selbst aus dem LocalStorage
    return this.predictOffline(text, userId, contextType);
  }

  /**
   * 📋 Funktion 2: Kategorieliste fürs Dropdown beim Öffnen
   * Spiegelt und funkt – holt entweder Server-Daten oder nutzt das lokale Backup.
   */
  public async getAvailableCategories(userId: string, contextType: 'todo' | 'note', localCategories: string[]): Promise<string[]> {
    if (this.connectionService.status() === 'ONLINE') {
      try {
        return await firstValueFrom(this.aiRepository.getServerCategories(contextType, userId));
      } catch (err) {
        console.warn('⚠️ Server-Kategorien nicht erreichbar, nutze lokale Kategorieliste...');
      }
    }

    const tagSet = this.getCategoriesFromLocalStorage(userId, contextType)
    return Array.from(tagSet).sort();
  }

  /**
   * 🕵️‍♂️ Der bereinigte Offline-Detektiv: Holt sich seine Daten jetzt AUTONOM aus dem LocalStorage!
   */
  private predictOffline(text: string, userId: string, contextType: 'todo' | 'note'): string {
    // Welcher Key? local_notes_123 oder local_todos_123
    const storageKey = contextType === 'note' ? `local_notes_${userId}` : `local_todos_${userId}`;
    const rawData = localStorage.getItem(storageKey);
    if (!rawData) return '';

    try {
      const items = JSON.parse(rawData) as any[];
      const searchWords = text.toLowerCase().split(' ').filter(w => w.length > 2);
      if (searchWords.length === 0) return '';

      const scoreTable = new Map<string, number>();

      // Feld-Mapping je nach Kontext (Notes nutzen 'tag', Todos nutzen 'category')
      const targetField = contextType === 'note' ? 'tag' : 'category';
      const fieldsToSearch = contextType === 'note' ? ['title', 'content'] : ['title', 'description'];

      for (const item of items) {
        if (!item) continue;
        const currentCategory = String(item[targetField] || '').trim();
        if (!currentCategory) continue;

        for (const field of fieldsToSearch) {
          const fieldValue = item[field];
          if (!fieldValue) continue;

          const textToSearch = String(fieldValue).toLowerCase();
          for (const word of searchWords) {
            if (textToSearch.includes(word)) {
              scoreTable.set(currentCategory, (scoreTable.get(currentCategory) || 0) + 1);
            }
          }
        }
      }

      let bestCategory = '';
      let highestScore = 0;
      scoreTable.forEach((score, category) => {
        if (score > highestScore) { highestScore = score; bestCategory = category; }
      });

      return bestCategory;
    } catch (e) {
      console.error('Fehler beim Offline-Predicting:', e);
      return '';
    }
  }

  /**
   * 💾 Reiner Offline-Kanal: Holt die echten Zettel/Todos aus dem LocalStorage und zieht die Tags raus
   */
  private getCategoriesFromLocalStorage(userId: string, contextType: 'todo' | 'note'): string[] {
    const storageKey = contextType === 'note' ? `local_notes_${userId}` : `local_todos_${userId}`;
    const data = localStorage.getItem(storageKey);
    if (!data) return [];

    try {
      const items = JSON.parse(data) as any[];
      const tagSet = new Set<string>();
      
      // Das Feld heißt bei Notes 'tag' und bei Todos meistens 'category' oder 'tag'
      const targetField = contextType === 'note' ? 'tag' : 'category';

      for (const item of items) {
        const value = item[targetField];
        if (value && String(value).trim() !== '') {
          tagSet.add(String(value).trim());
        }
      }
      return Array.from(tagSet).sort();
    } catch (e) {
      return [];
    }
  }
}