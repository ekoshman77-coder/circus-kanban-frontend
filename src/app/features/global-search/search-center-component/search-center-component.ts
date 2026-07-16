import { Component, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { FilterService, SearchCategory } from '../../../core/services/filter/filter-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface IFilter {
  value: SearchCategory; 
  label: string; 
  icon: string; 
}

@Component({
  selector: 'app-search-center-component',
  standalone: true, // Falls es eine Standalone-Komponente ist
  imports: [CommonModule, FormsModule],
  templateUrl: './search-center-component.html',
  styleUrl: './search-center-component.css',
})
export class SearchCenterComponent implements OnInit, OnDestroy {
  // Das Gehirn (Service) reinholen
  protected filterService = inject(FilterService);

  protected currentCategory = computed(() => this.filterService.currentCategory());

  readonly categories: IFilter[] = [
    { value: 'all', label: 'Alles', icon: '🔍' },
    { value: 'team', label: 'Team', icon: '👥' },
    { value: 'projects', label: 'Projekte', icon: '💼' },
    { value: 'ideas', label: 'Ideen', icon: '💡' },
    { value: 'todos', label: 'To-Dos', icon: '✅' }
  ];

  // ⚡ Ein privater Stream, um die Tastatur-Eingaben abzufangen und zu drosseln
  private searchInput$ = new Subject<string>();
  private searchSubscription?: Subscription;

  ngOnInit(): void {
    // 🛡️ Hier passiert die Magie: Erst wenn 250ms kein Tastendruck kam,
    // schreiben wir den Wert in das reaktive Signal!
    this.searchSubscription = this.searchInput$.pipe(
      debounceTime(400),
      distinctUntilChanged() // Verhindert Updates, wenn sich der Text nicht geändert hat
    ).subscribe(text => {
      this.filterService.searchTerm.set(text);
    });
  }

  public onCategoryChange(newCategory: SearchCategory) {
    this.filterService.currentCategory.set(newCategory);
  }

  // 🌟 REPARATUR 2: Wir leiten den getippten Text zuerst in unseren Bremser-Stream!
  public onSearchTermChange(text: string) {
    this.searchInput$.next(text);
  }

  ngOnDestroy(): void {
    // 🧹 Speicherlecks verhindern
    this.searchSubscription?.unsubscribe();
  }
}