import { inject, Injectable } from '@angular/core';
import { ConnectionService } from '../connection/connection-service';
import { AiRepository } from '../../repositories/ai-repository';
import { firstValueFrom } from 'rxjs';

/**
 * Universeller Vorhersage-Service für das gesamte System.
 */
@Injectable({
  providedIn: 'root'
})
export class UniversalPredictorService {
  private aiRepository = inject(AiRepository);
  private connectionService = inject(ConnectionService);

  /**
   * Sagt die am besten passende Kategorie für ein To-Do oder eine Notiz voraus.
   */
  public async predict(
    text: string, 
    userId: string, 
    contextType: 'todo' | 'note' | 'sanitization', 
    patternType?: string
  ): Promise<string> {
    if (!text || text.trim().length < 3) return '';

    if (this.connectionService.status() === 'ONLINE') {
      try {
        console.log("prediction from service läuft");
        
        // Argumente dynamisch zusammenbauen, damit undefined nicht erzwungen wird
        const args: [string, 'todo' | 'note' | 'sanitization', string?] = [text, contextType];
        if (patternType !== undefined) {
          args.push(patternType);
        }

        return (await firstValueFrom(
          this.aiRepository.getServerPrediction(...args)
        )).suggestedCategory;
      } catch (err) {
        console.warn('⚡ Server-KI nicht erreichbar...');
      }
    }

    // 💡 Fallback auf Offline-Heuristik, wenn offline oder nach Serverfehler
    if (contextType === 'todo' || contextType === 'note') {
      return this.predictOffline(text, userId, contextType);
    }

    return '';
  }

  /**
   * Sagt den voraussichtlichen Zeitaufwand (in Stunden) für eine Aufgabe voraus.
   */
  public async predictEffort(text: string): Promise<number | null> {
    if (!text || text.trim().length < 3) return null;

    if (this.connectionService.status() === 'ONLINE') {
      try {
        const res = await firstValueFrom(this.aiRepository.getServerEffortPrediction({
          text: text,
          contextType: "todo"
        }));
        return res.suggestedEffort;
      } catch (err) {
        console.warn('⚡ Server-KI für Aufwand nicht erreichbar.');
        return null;
      }
    }
    return null;
  }

  /**
   * Liefert alle verfügbaren Kategorien für Dropdown-Auswahlen.
   */
  public async getAvailableCategories(userId: string, contextType: 'todo' | 'note' | 'sanitization', localCategories: string[]): Promise<string[]> {
    if (this.connectionService.status() === 'ONLINE') {
      try {
        return await firstValueFrom(this.aiRepository.getServerCategories(contextType));
      } catch (err) {
        console.warn('⚠️ Server-Kategorien nicht erreichbar, nutze lokale Kategorieliste...');
      }
    }

    if (contextType === 'sanitization') {
      return localCategories;
    }

    const tagSet = this.getCategoriesFromLocalStorage(userId, contextType);
    return tagSet.length > 0 ? tagSet : localCategories;
  }

  /**
   * Heuristischer Offline-Algorithmus.
   */
  private predictOffline(text: string, userId: string, contextType: 'todo' | 'note'): string {
    const storageKey = contextType === 'note' ? `local_notes_${userId}` : `local_todos_${userId}`;
    const rawData = localStorage.getItem(storageKey);
    if (!rawData) return '';

    try {
      const items = JSON.parse(rawData) as any[];
      const searchWords = text.toLowerCase().split(' ').filter(w => w.length > 2);
      if (searchWords.length === 0) return '';

      const scoreTable = new Map<string, number>();

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
        if (score > highestScore) {
          highestScore = score;
          bestCategory = category;
        }
      });

      return bestCategory;
    } catch (e) {
      console.error('Fehler beim Offline-Predicting:', e);
      return '';
    }
  }

  /**
   * Extrahiert alle einzigartigen Kategorien oder Tags direkt aus dem LocalStorage.
   */
  private getCategoriesFromLocalStorage(userId: string, contextType: 'todo' | 'note'): string[] {
    const storageKey = contextType === 'note' ? `local_notes_${userId}` : `local_todos_${userId}`;
    const data = localStorage.getItem(storageKey);
    if (!data) return [];

    try {
      const items = JSON.parse(data) as any[];
      const tagSet = new Set<string>();

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