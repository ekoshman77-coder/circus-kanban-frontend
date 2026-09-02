import { Component, Output, EventEmitter, input, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterService } from '../../../services/filter/filter-service';

// 🟢 Minimales Interface oder Import deines Department-Typs
export interface DepartmentItem {
  id: string;
  name: string;
}

export interface FilterState {
  query: string;
  mode: 'AND' | 'OR';
  tag: string;
  color: string;
  departmentId?: string; // 🟢 NEU: Optionale Abteilungs-ID für Admins
}

@Component({
  selector: 'app-board-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './board-filter-component.html',
  styleUrls: ['./board-filter-component.css']
})
export class BoardFilterComponent {
  public availableTags = input<string[]>([]);
  public availableColors = input<string[]>([]);
  // 🟢 NEU: Liste der verfügbaren Abteilungen
  public availableDepartments = input<DepartmentItem[]>([]);

  private filterService = inject(FilterService);

  public searchQuery: string = '';
  public searchMode: 'AND' | 'OR' = 'AND';
  public tagFilter: string = '';
  public colorFilter: string = '';
  public departmentFilter: string = ''; // 🟢 NEU: Ausgewählte Department-ID

  @Output() filterChanged = new EventEmitter<FilterState>();

  constructor() {
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
      color: this.colorFilter,
      departmentId: this.departmentFilter // 🟢 NEU
    });
  }

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
  // 🟢 NEU: Handler für Abteilungswechsel
  public onDepartmentFilterChange(val: string): void { this.departmentFilter = val; this.emitChange(); }

  public resetAll(): void {
    this.searchQuery = '';
    this.filterService.searchTerm.set('');
    this.searchMode = 'AND';
    this.tagFilter = '';
    this.colorFilter = '';
    this.departmentFilter = ''; // 🟢 NEU
    this.emitChange();
  }
}