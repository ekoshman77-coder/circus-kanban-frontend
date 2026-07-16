import { Injectable, signal, computed } from '@angular/core';

// Wir definieren die Kategorien, die es in deiner App gibt
export type SearchCategory = 'all' | 'team' | 'projects' | 'ideas' | 'milestones' | 'todos';

@Injectable({
  providedIn: 'root'
})
export class FilterService {
  // 1. Die aktiven Filter als beschreibbare Signals
  searchTerm = signal<string>('');
  currentCategory = signal<SearchCategory>('all');
  
  // Schnell-Filter für Spezialfälle (z.B. Schulden in Kaffeekasse oder gesperrt im Pool)
  showOnlyAlerts = signal<boolean>(false);

  constructor() {}

  // 2. Eine einfache Methode, mit der eine geöffnete Seite ihre Standard-Kategorie setzen kann
  setInitialCategory(category: SearchCategory) {
    this.currentCategory.set(category);
    // Wenn die Kategorie wechselt, setzen wir die Suche meistens zurück, 
    // es sei denn, du möchtest den Suchbegriff "mitnehmen"
    this.searchTerm.set(''); 
    this.showOnlyAlerts.set(false);
  }

  // 3. Hilfsmethode zum Zurücksetzen aller Filter
  resetAll() {
    this.searchTerm.set('');
    this.currentCategory.set('all');
    this.showOnlyAlerts.set(false);
  }
}