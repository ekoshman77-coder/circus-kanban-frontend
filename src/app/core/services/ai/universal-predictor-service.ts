import { inject, Injectable } from '@angular/core';
import { ConnectionService } from '../connection/connection-service';
import { AiRepository } from '../../repositories/ai-repository';
import { firstValueFrom } from 'rxjs';

/**
 * Universeller Vorhersage-Service für das gesamte System.
 * * Agiert als zentraler, hybrider Detektiv, der:
 * 1. Kategorien für To-Dos und Notizen basierend auf Textanalysen prognostiziert (Online via KI, Offline via LocalStorage-Heuristik).
 * 2. Aufwandsschätzungen (Effort-Predictions) anhand von globalen Team-Benchmarks berechnet.
 * 3. Dynamisch Kategorielisten ausliest, um sie in Formularen anzubieten.
 */
@Injectable({
  providedIn: 'root'
})
export class UniversalPredictorService {
  private aiRepository = inject(AiRepository);
  private connectionService = inject(ConnectionService);

  /**
   * Sagt die am besten passende Kategorie für ein To-Do oder eine Notiz voraus.
   * * Entscheidet dynamisch anhand des Verbindungsstatus:
   * - **ONLINE:** Ruft das serverbasierte KI-Modell auf.
   * - **OFFLINE:** Analysiert lokal gespeicherte Daten im LocalStorage über ein Häufigkeits-Punktesystem.
   * * @param text Der Freitext des Elements (z. B. Titel oder Beschreibung).
   * @param userId Die ID des Benutzers (für den Offline-Fallback).
   * @param contextType Der Kontext der Anfrage ('todo' oder 'note').
   * @returns Ein Promise mit der vorgeschlagenen Kategorie oder einem leeren String bei ungültigem Input.
   */
  public async predict(text: string, userId: string, contextType: 'todo' | 'note'): Promise<string> {
    if (!text || text.trim().length < 3) return '';

    // 🌐 Online-Pfad: Nutzt die Server-KI
    if (this.connectionService.status() === 'ONLINE') {
      try {
        return (await firstValueFrom(this.aiRepository.getServerPrediction(text, contextType))).suggestedCategory;
      } catch (err) {
        console.warn('⚡ Server-KI zickt, wechsle reibungslos in den Offline-Modus...');
        return this.predictOffline(text, userId, contextType);
      }
    }

    // Offline-Pfad: Holt sich die Daten autonom aus dem LocalStorage
    return this.predictOffline(text, userId, contextType);
  }

  /**
   * Sagt den voraussichtlichen Zeitaufwand (in Stunden) für eine Aufgabe voraus.
   * Nutzt dafür einen globalen Team-Benchmark auf dem Server.
   * * @param text Der Aufgabentext.
   * @returns Ein Promise mit der geschätzten Stundenzahl oder `null`, falls offline oder nicht ermittelbar.
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
   * Versucht im Online-Modus globale Kategorien zu laden, andernfalls werden
   * die bereits genutzten Kategorien aus dem lokalen Cache des Nutzers extrahiert.
   * * @param userId Die ID des Benutzers.
   * @param contextType Der Kontext der Anfrage ('todo' oder 'note').
   * @param localCategories Optionale Standardkategorien als finaler Fallback.
   * @returns Ein Promise mit einem sortierten Array von Kategorienamen.
   */
  public async getAvailableCategories(userId: string, contextType: 'todo' | 'note', localCategories: string[]): Promise<string[]> {
    if (this.connectionService.status() === 'ONLINE') {
      try {
        return await firstValueFrom(this.aiRepository.getServerCategories(contextType));
      } catch (err) {
        console.warn('⚠️ Server-Kategorien nicht erreichbar, nutze lokale Kategorieliste...');
      }
    }

    const tagSet = this.getCategoriesFromLocalStorage(userId, contextType);
    return tagSet.length > 0 ? tagSet : localCategories;
  }

  /**
   * Heuristischer Offline-Algorithmus.
   * Durchsucht den LocalStorage nach Übereinstimmungen im Titel und Inhalt/Beschreibung
   * und bewertet, welche Kategorie am häufigsten mit ähnlichen Wörtern verknüpft war.
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