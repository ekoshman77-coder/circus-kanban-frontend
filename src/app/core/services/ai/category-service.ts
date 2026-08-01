import { inject, Injectable } from '@angular/core';
import { TodoRepository } from '../../repositories/todo-repository';
import { ConnectionService } from '../connection/connection-service';
import { Todo } from '../../models/todo';
import { firstValueFrom } from 'rxjs';

/**
 * Service für das intelligente Kategorien-Management.
 * * Bietet eine Hybrid-Architektur:
 * - **Online:** Ermittelt Kategorien und Vorhersagen direkt über das KI-gestützte Kotlin-Backend.
 * - **Offline:** Nutzt einen heuristischen "Offline-Detektiv"-Algorithmus im Frontend, der basierend auf
 * bestehenden To-Dos und Stichwortübereinstimmungen die am besten passende Kategorie vorschlägt.
 */
@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private todoRepository = inject(TodoRepository);
  private connectionService = inject(ConnectionService);

  /**
   * Liefert alle verfügbaren Kategorien für einen Benutzer.
   * Holt die Daten bei aktiver Internetverbindung vom Server, andernfalls werden sie
   * dynamisch aus den bereits lokal geladenen To-Dos extrahiert.
   * * @param userId Die ID des Benutzers.
   * @param aktuelleTodos Die Liste der aktuell im Frontend geladenen To-Dos.
   * @returns Ein Promise mit einem Array aller einzigartigen Kategorienamen, alphabetisch sortiert.
   */
  public async getAllCategories(userId: string, aktuelleTodos: Todo[]): Promise<string[]> {
    if (this.connectionService.status() === 'ONLINE') {
      try {
        return await firstValueFrom(this.todoRepository.getServerCategories(userId));
      } catch (err) {
        // Fallback, falls der Server trotz Online-Status fehlschlägt
        return this.extractCategoriesFromTodos(aktuelleTodos);
      }
    }
    // Offline-Pfad
    return this.extractCategoriesFromTodos(aktuelleTodos);
  }

  /**
   * Sagt die am besten passende Kategorie für einen Aufgabentext voraus.
   * * @param text Der Aufgabentext (z. B. "Milch kaufen").
   * @param userId Die ID des Benutzers.
   * @param aktuelleTodos Die Liste der aktuellen To-Dos zur Offline-Analyse.
   * @returns Ein Promise mit dem Namen der empfohlenen Kategorie (Standard: 'Allgemein').
   */
  public async predictCategory(text: string, userId: string, aktuelleTodos: Todo[]): Promise<string> {
    if (!text || text.trim().length < 3) {
      return 'Allgemein';
    }

    // 🌐 ONLINE-PFAD: Über das Repository gehen
    if (this.connectionService.status() === 'ONLINE') {
      try {
        const res = await firstValueFrom(this.todoRepository.getAiCategorySuggestion(text, userId));
        return res?.suggestedCategory || 'Allgemein';
      } catch (err) {
        // Fallback bei Server-Fehlern im Online-Modus
        return this.runOfflineDetective(text, aktuelleTodos);
      }
    }

    // 🔌 OFFLINE-PFAD: Heuristische Analyse im Frontend
    return this.runOfflineDetective(text, aktuelleTodos);
  }

  /**
   * Extrahiert alle einzigartigen Kategorien aus einer Liste von To-Dos.
   * Garantiert, dass 'Allgemein' immer in der Liste enthalten ist.
   * * @param todos Die zu analysierenden To-Dos.
   * @returns Ein sortiertes Array einzigartiger Kategorienamen.
   */
  private extractCategoriesFromTodos(todos: Todo[]): string[] {
    const einzigartigeKategorien = new Set(todos.map(t => t.category || 'Allgemein'));
    einzigartigeKategorien.add('Allgemein');
    return Array.from(einzigartigeKategorien).sort();
  }

  /**
   * 🕵️‍♂️ DER FRONTEND-OFFLINE-DETEKTIV
   * Analysiert den Aufgabentext offline und gleicht Wörter mit bestehenden Aufgaben ab,
   * um die wahrscheinlichste Kategorie basierend auf einem Punktesystem zu ermitteln.
   * * @param text Der eingegebene Aufgabentext.
   * @param aktuelleTodos Die Liste bestehender To-Dos als Datenbasis.
   * @returns Die Kategorie mit den meisten Übereinstimmungen oder 'Allgemein'.
   */
  private runOfflineDetective(text: string, aktuelleTodos: Todo[]): string {
    const suchWoerter = text.toLowerCase().split(' ').filter(w => w.length > 2);
    if (suchWoerter.length === 0) return 'Allgemein';

    const punkteTabelle = new Map<string, number>();

    for (const todo of aktuelleTodos) {
      const taskGekleint = todo.task.toLowerCase();
      const kategorie = todo.category || 'Allgemein';

      for (const wort of suchWoerter) {
        if (taskGekleint.includes(wort)) {
          const aktuellePunkte = punkteTabelle.get(kategorie) || 0;
          punkteTabelle.set(kategorie, aktuellePunkte + 1);
        }
      }
    }

    let besteKategorie = 'Allgemein';
    let hoechstePunkte = 0;

    punkteTabelle.forEach((punkte, kat) => {
      if (punkte > hoechstePunkte) {
        hoechstePunkte = punkte;
        besteKategorie = kat;
      }
    });

    return besteKategorie;
  }
}