import { inject, Injectable } from '@angular/core';
import { TodoRepository } from '../../repositories/todo-repository';
import { ConnectionService } from '../connection/connection-service';
import { Todo } from '../../models/todo';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private todoRepository = inject(TodoRepository); // 👈 Nutzung des Repositories
  private connectionService = inject(ConnectionService);

  /**
   * 📋 3) DIE NEUE FUNKTION: Holt die Liste aller Kategorien
   * Online: Direkt vom Server aus dem KI-Gedächtnis.
   * Offline: Dynamisch aus den im Frontend geladenen Todos extrahiert.
   */
  public async getAllCategories(userId: string, aktuelleTodos: Todo[]): Promise<string[]> {
    if (this.connectionService.status() === 'ONLINE') {
      try {
        return await firstValueFrom(this.todoRepository.getServerCategories(userId));
      } catch (err) {
        // Fallback, falls der Server trotz Online-Status zickt
        return this.extractCategoriesFromTodos(aktuelleTodos);
      }
    }
    // Offline-Pfad
    return this.extractCategoriesFromTodos(aktuelleTodos);
  }

  /**
   * 🔮 DIE HYBRID-VORHERSAGE (Nutzt jetzt das TodoRepository!)
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
        return this.runOfflineDetective(text, aktuelleTodos);
      }
    }

    // 🔌 OFFLINE-PFAD
    return this.runOfflineDetective(text, aktuelleTodos);
  }

  /**
   * Hilfsmethode: Extrahiert einzigartige Kategorien aus der aktuellen Todo-Liste
   */
  private extractCategoriesFromTodos(todos: Todo[]): string[] {
    const einzigartigeKategorien = new Set(todos.map(t => t.category || 'Allgemein'));
    einzigartigeKategorien.add('Allgemein');
    return Array.from(einzigartigeKategorien).sort();
  }

  /**
   * 🕵️‍♂️ DER FRONTEND-OFFLINE-DETEKTIV
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
