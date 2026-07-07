import { Component, Output, EventEmitter, input, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterService } from '../../../core/services/filter-service';

export interface FilterState {
  query: string;
  mode: 'AND' | 'OR';
  tag: string;
  color: string;
}

@Component({
  selector: 'app-board-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './board-filter-component.html',
  styleUrls: ['./board-filter-component.css']
})
export class BoardFilterComponent {
  // 🌟 Die dynamischen Listen, die von der Hauptkomponente kommen
  public availableTags = input<string[]>([]);
  public availableColors = input<string[]>([]);
  private filterService = inject(FilterService)

  // Interne Zustände der Eingabefelder
  public searchQuery: string = '';
  public searchMode: 'AND' | 'OR' = 'AND';
  public tagFilter: string = '';  // Wird jetzt über ein Select-Feld gesteuert
  public colorFilter: string = '';

  @Output() filterChanged = new EventEmitter<FilterState>();

  constructor() {
    // 🚀 DIE AUTOMATISCHE BRÜCKE:
    // Sobald sich der globale searchTerm ändert (z.B. durch Header-Eingabe oder Reset),
    // aktualisieren wir die lokale searchQuery und triggern den Board-Filter!
    effect(() => {
      const globalTerm = this.filterService.searchTerm();
      if (this.searchQuery !== globalTerm) {
        this.searchQuery = globalTerm;
        this.emitChange();
      }
    });
  }
  
  private emitChange(): void {
    this.filterChanged.emit({
      query: this.searchQuery,
      mode: this.searchMode,
      tag: this.tagFilter,
      color: this.colorFilter
    });
  }

  // Hilfsmethode, um den lesbaren Namen der Farbe für das Dropdown anzuzeigen
  public getColorLabel(colorType: string): string {
    switch (colorType) {
      case 'note-yellow': return 'Gelb 🟡';
      case 'note-green': return 'Grün 🟢';
      case 'note-pink': return 'Pink 🌸';
      case 'note-blue': return 'Blau 🔵';
      default: return colorType;
    }
  }

  public onSearchQueryChange(val: string): void {
     this.searchQuery = val; 
     this.filterService.searchTerm.set(val);
     this.emitChange(); 
  }

  public onSearchModeChange(val: 'AND' | 'OR'): void { this.searchMode = val; this.emitChange(); }

  public onTagFilterChange(val: string): void { this.tagFilter = val; this.emitChange(); }

  public onColorFilterChange(val: string): void { this.colorFilter = val; this.emitChange(); }

  public resetAll(): void {
    this.searchQuery = '';
    this.filterService.searchTerm.set('');
    this.searchMode = 'AND';
    this.tagFilter = '';
    this.colorFilter = '';
    this.emitChange();
  }
}