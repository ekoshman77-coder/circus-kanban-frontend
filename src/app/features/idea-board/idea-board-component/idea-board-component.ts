import { Component, inject, signal, effect, computed, OnInit } from '@angular/core';
import { Note } from '../../../core/models/note';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { NoteComponent } from '../note-component/note-component';
import { NoteService } from '../../../core/services/note/note-service';
import { NoteViewModel } from '../../../core/viewmodel/note-view-model';
import { IdeaSortingService } from '../../../core/services/note/idea-sorting-service';
import { NoteSortOrder } from '../../../core/models/note-sort-order';
import { BoardFilterComponent, FilterState } from '../board-filter-component/board-filter-component';
import { NotesStatisticsComponent } from '../notes-statistics-component/notes-statistics-component';
import { TabNavigationService } from '../tab-navigation-service';
import { BoardTab } from '../tab-navigation-service';
import { NoteInputComponent } from '../note-input-component/note-input-component';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TodoPlanningModalComponent } from '../../../core/shared/components/todo-planning-modal-component/todo-planning-modal-component';
import { UserService } from '../../../core/services/user/user-service';

/**
 * @component IdeaBoardComponent
 * @description Die digitale Magnettafel unseres Systems. Verwaltet das Erstellen, Filtern, 
 * Sortieren und Verteilen von Notizen (Ideen) via Drag & Drop in den Kalkulator-Schlitz oder den Mülleimer[cite: 7, 8, 9].
 */
@Component({
  selector: 'app-idea-board',
  standalone: true,
  imports: [
    DragDropModule,
    NoteComponent,
    FormsModule,
    BoardFilterComponent,
    NotesStatisticsComponent,
    NoteInputComponent,
    TodoPlanningModalComponent
  ],
  templateUrl: './idea-board-component.html',
  styleUrls: ['./idea-board-component.css']
})
export class IdeaBoardComponent implements OnInit {
  // -------------------------------------------------------------------------
  // 🛠️ INJIZIERTE SERVICES
  // -------------------------------------------------------------------------
  private noteService = inject(NoteService);
  private boardStateService = inject(IdeaSortingService);
  private userService = inject(UserService);
  private tabService = inject(TabNavigationService);
  private filterService = inject(FilterService);

  // -------------------------------------------------------------------------
  // 🚦 REAKTIVE ZUSTÄNDE (SIGNALS)
  // -------------------------------------------------------------------------
  
  /** Der aktuell aktive Filterzustand (Suchbegriff, Verknüpfungsmodus, Tag, Farbe)[cite: 9] */
  public currentFilters = signal<FilterState>({ query: '', mode: 'AND', tag: '', color: '' });

  /** Formular-Zustand: Titel einer manuell via Fallback erstellten Notiz[cite: 9] */
  public newTitle: string = "";
  /** Formular-Zustand: Inhalt einer manuell via Fallback erstellten Notiz[cite: 9] */
  public newContent: string = "";
  /** Formular-Zustand: Kartenfarbe einer manuell via Fallback erstellten Notiz[cite: 9] */
  public newColor: string = 'note-yellow';
  /** Formular-Zustand: Tag/Fachbereich einer manuell via Fallback erstellten Notiz[cite: 9] */
  public newTag: string = "";

  /** 🌟 UI-EXKLUSIVER ZUSTAND: Hält die transformierten und angereicherten Notizen-Ausstellungsstücke (ViewModels)[cite: 9] */
  public viewModels = signal<NoteViewModel[]>([]);
  
  /** Interner Cache, um bestehende ViewModels bei Daten-Updates reaktiv zu recyclen[cite: 9] */
  private viewModelCache: NoteViewModel[] = [];
  
  /** Direktes Lese-Signal auf die rohe Notizen-Liste aus der Datenbank[cite: 9] */
  public currentNotes = computed(() => this.noteService.notesList());
  
  /** Steuert die Anzeige des Todo-Planungs-Modal-Popups[cite: 8, 9] */
  public isTodoPopupShow = signal<boolean>(false);

  /** KI-Zwischenspeicher: Titel der Idee, die in ein Todo konvertiert werden soll[cite: 8, 9] */
  public ideaToPlanTitle = signal<string>('');
  /** KI-Zwischenspeicher: Beschreibung der Idee, die in ein Todo konvertiert werden soll[cite: 8, 9] */
  public ideaToPlanDescription = signal<string>('');
  /** KI-Zwischenspeicher: Vorgeschlagene Kategorie für das geplante Todo[cite: 8, 9] */
  public ideaToPlanCategory = signal<string>('');

  // -------------------------------------------------------------------------
  // 🏗️ LIFECYCLE & EFFECT-WARTESHLEIFE
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    /** Setzt die globale Suche fest auf die Kategorie 'ideas', um boardfremde Elemente zu ignorieren[cite: 9] */
    this.filterService.setInitialCategory('ideas');
  }

  constructor() {
    /**
     * 🛡️ DIE REAKTIVE WARTESHLEIFE
     * Wartet, bis das Backend Daten liefert, und transformiert sie kontrolliert in ViewModels[cite: 9].
     * Erlaubt explizite Signals-Schreibrechte (`allowSignalWrites`), um NG0600-Konflikte im Konstruktor zu verhindern[cite: 9].
     */
    effect(() => {
      const rawNotes = this.noteService.notesList();
      console.log('👀 Liste auf dem Board:', rawNotes);
      
      this.viewModelCache = rawNotes.map(note => {
        const existingVM = this.viewModelCache.find(vm => vm.note.id === note.id);
        if (existingVM) {
          existingVM.note = note; // Updatet reaktiv die Daten, behält den UI-State bei
          return existingVM;
        } else {
          return new NoteViewModel(note);
        }
      });

      this.viewModels.set(this.viewModelCache);
    });
  }

  // -------------------------------------------------------------------------
  // 📌 NOTIZ-AKTIONEN (CRUD)
  // -------------------------------------------------------------------------

  /** Erstellt eine neue Notiz direkt über das Board-Eingabefeld[cite: 9] */
  public createNewNote(): void {
    if (!this.newTitle.trim()) return;
    this.noteService.addNote({
      title: this.newTitle,
      content: this.newContent,
      colorType: this.newColor,
      tag: this.newTag
    });
    this.newTitle = '';
    this.newContent = '';
    this.newColor = 'note-yellow';
    this.newTag = "";
  }

  /** Leitet Aktualisierungen an einer Notiz (z.B. Textänderung) an den Service weiter[cite: 8, 9] */
  public onNoteUpdated(updatedNote: Note): void {
    this.noteService.updateNote(updatedNote);
  }

  /** Löscht eine spezifische Notiz permanent aus dem System[cite: 9] */
  public onNoteDeleted(id: string): void {
    this.noteService.removeNote(id);
  }

  /** Verarbeitet Filteränderungen aus der UI und synchronisiert sie mit dem Suchbegriff-Service[cite: 8, 9] */
  public onFilterChanged(newFilters: FilterState): void {
    this.currentFilters.set(newFilters);
    this.filterService.searchTerm.set(newFilters.query);
  }

  // -------------------------------------------------------------------------
  // 🔄 DRAG & DROP LOGIK
  // -------------------------------------------------------------------------

  /**
   * 🔄 DER ZENTRALE DRAG & DROP VERTEILER
   * Entscheidet anhand der Ziel-Container-ID, ob gelöscht, kalkuliert oder sortiert wird[cite: 8, 9].
   */
  public onDropped(event: CdkDragDrop<any[]>): void {
    // Sektor 1: Im Mülleimer gelandet 🗑️
    if (event.container.id === 'trashList') {
      this.handleTrashDrop(event.item.data);
      return;
    }

    // Sektor 2: Im Automaten-Schlitz gelandet 🎰
    if (event.container.id === 'calculatorList') {
      this.handleCalculatorDrop(event.item.data);
      return;
    }

    // Sektor 3: Umsortieren auf der Pinnwand 📌
    this.handleBoardSorting(event.previousIndex, event.currentIndex);
  }

  /** Verarbeitet das Hineinwerfen einer Karte in die Mülltonne[cite: 8, 9] */
  private handleTrashDrop(data: any): void {
    const vmToDelete = data as NoteViewModel;
    if (vmToDelete && vmToDelete.note.id) {
      this.onNoteDeleted(vmToDelete.note.id);
    }
  }

  /** 
   * 🛡️ MÜLLEIMER-PRÄDIKAT
   * Prüft in Echtzeit vor dem Drop, ob der aktuelle User die Berechtigung besitzt, diese Idee zu löschen[cite: 8, 9].
   */
  public canIdeaEnterTrash = (drag: any): boolean => {
    const vm = drag.data as NoteViewModel;
    if (!vm) return false;
    const currentUserId = this.userService.getCurrentUserId();
    return vm.canDelete(currentUserId);
  };

  /** 
   * 🎰 AUTOMATEN-DROP
   * Wirft die Idee in den vertikalen Schlitz und triggert den Tab-Wechsel in das Kalkulator-Labor[cite: 7, 8, 9].
   */
  private handleCalculatorDrop(data: any): void {
    const vmToCalculator = data as NoteViewModel;
    if (!vmToCalculator || !vmToCalculator.note.id) return;

    console.log('🎰 Münze eingeworfen für:', vmToCalculator.note.title);

    try {
      console.log('🗺️ Schalte Tab auf Kalkulator für Idee-ID:', vmToCalculator.note.id);
      this.tabService.changeTab(BoardTab.Calculator, {
        type: 'idea',
        id: vmToCalculator.note.id
      });
    } catch (error) {
      console.error('Kritischer Fehler im Drag&Drop-Kalkulationsablauf:', error);
    }
  }

  /** Ändert die Reihenfolge der Elemente direkt auf dem Board und speichert den neuen Index permanent[cite: 8, 9] */
  private handleBoardSorting(previousIndex: number, currentIndex: number): void {
    const currentSorted = [...this.sortedViewModels()];
    moveItemInArray(currentSorted, previousIndex, currentIndex);

    const newOrders: NoteSortOrder[] = currentSorted.map((vm, index) => ({
      noteId: vm.note.id ?? "",
      sortIndex: index
    }));

    this.boardStateService.saveSorting(newOrders);
  }

  // -------------------------------------------------------------------------
  // 🧠 REVOLUTIONÄRES FILTER-PIPELINE-SYSTEM
  // -------------------------------------------------------------------------

  /**
   * 🔀 DIE FILTER-PIPELINE
   * Rechnet völlig unabhängig von der Ausführungsreihenfolge Text-, Farb- und Tag-Schnittmengen aus.
   * Eliminiert Seiteneffekte und stellt Daten kreuzweise für dynamische Dropdowns bereit[cite: 9].
   */
  private filterPipeline = computed(() => {
    const allVMs = this.viewModels();
    const filters = this.currentFilters();
    const searchQuery = this.filterService.searchTerm().toLowerCase().trim();
    const tagFilter = filters.tag.toLowerCase().trim();
    const colorFilter = filters.color;

    let textFiltered = [...allVMs];

    // Multi-Term-Textsuche mit Komma-Trennung (unterstützt AND/OR Verknüpfungen)[cite: 9]
    if (searchQuery) {
      const searchTerms = searchQuery.split(',').map(term => term.trim()).filter(term => term.length > 0);
      textFiltered = textFiltered.filter(vm => {
        const title = vm.note.title.toLowerCase();
        const content = vm.note.content.toLowerCase();
        return filters.mode === 'AND'
          ? searchTerms.every(term => title.includes(term) || content.includes(term))
          : searchTerms.some(term => title.includes(term) || content.includes(term));
      });
    }

    // Teilstrom für dynamische Tags (berücksichtigt Text- und Farbfilter)[cite: 9]
    let forTags = [...textFiltered];
    if (colorFilter) { forTags = forTags.filter(vm => vm.note.colorType === colorFilter); }

    // Teilstrom für dynamische Farben (berücksichtigt Text- und Tagfilter)[cite: 9]
    let forColors = [...textFiltered];
    if (tagFilter) {
      if (tagFilter === 'none') { forColors = forColors.filter(vm => !vm.note.tag || !vm.note.tag.trim()); }
      else { forColors = forColors.filter(vm => vm.note.tag && vm.note.tag.toLowerCase().includes(tagFilter)); }
    }

    // Finales Ergebnis nach Anwendung aller Filterkriterien[cite: 9]
    let finalSelection = [...textFiltered];
    if (tagFilter) {
      if (tagFilter === 'none') { finalSelection = finalSelection.filter(vm => !vm.note.tag || !vm.note.tag.trim()); }
      else { finalSelection = finalSelection.filter(vm => vm.note.tag && vm.note.tag.toLowerCase().includes(tagFilter)); }
    }
    if (colorFilter) { finalSelection = finalSelection.filter(vm => vm.note.colorType === colorFilter); }

    return { finalSelection, dataForColors: forColors, dataForTags: forTags };
  });

  /** 📊 Das finale, sortierte Ausgabe-Signal für das Zettel-Grid[cite: 8, 9] */
  public sortedViewModels = computed(() => {
    const { finalSelection } = this.filterPipeline();
    const orders = this.boardStateService.currentSortOrders();

    if (orders.length === 0) return finalSelection;
    return [...finalSelection].sort((a, b) => {
      const indexA = orders.find(o => o.noteId === a.note.id)?.sortIndex ?? 999;
      const indexB = orders.find(o => o.noteId === b.note.id)?.sortIndex ?? 999;
      return indexA - indexB;
    });
  });

  /** 🏷️ Berechnet dynamisch alle verfügbaren Tags basierend auf den aktiven Filtern[cite: 8, 9] */
  public availableTags = computed(() => {
    const { dataForTags } = this.filterPipeline();
    const tagSet = new Set<string>();
    let hatNotizenOhneTag = false;

    dataForTags.forEach(vm => {
      if (vm.note.tag && vm.note.tag.trim()) {
        tagSet.add(vm.note.tag.trim());
      } else {
        hatNotizenOhneTag = true;
      }
    });

    const sortierteTags = Array.from(tagSet).sort();
    return hatNotizenOhneTag ? ['none', ...sortierteTags] : sortierteTags;
  });

  /** 🌈 Berechnet dynamisch alle verfügbaren Kartenfarben basierend auf den aktiven Filtern[cite: 8, 9] */
  public availableColors = computed(() => {
    const { dataForColors } = this.filterPipeline();
    const colorSet = new Set<string>();

    dataForColors.forEach(vm => {
      if (vm.note.colorType) {
        colorSet.add(vm.note.colorType);
      }
    });

    return Array.from(colorSet);
  });

  /** 🛡️ KALKULATOR-PRÄDIKAT: Validiert vor dem Drop, ob eine Idee kalkuliert werden darf[cite: 8, 9] */
  public canIdeaEnterCalculator = (drag: any): boolean => {
    const vm = drag.data;
    return vm ? vm.canEnterCalculator() : false;
  };

  /** Hilfsmethode zur String-Validierung bei Tag-Wechseln[cite: 9] */
  public onTagChanged(neuerTag: any): void {
    this.newTag = String(neuerTag || '');
  }

  // -------------------------------------------------------------------------
  // 🔮 KI INTERAKTION & MODAL MANAGEMENT
  // -------------------------------------------------------------------------

  /** Öffnet das Todo-Planungs-Popup und injiziert die von der KI vorgeschlagenen strukturierten Daten[cite: 8, 9] */
  public openTodoPlanningFromIdea(ideaData: { title: string; content: string; category: string }): void {
    console.log("🎯 KI-Daten empfangen, wir füttern die Signale und öffnen das Popup!");
    this.ideaToPlanTitle.set(ideaData.title);
    this.ideaToPlanDescription.set(ideaData.content);
    this.ideaToPlanCategory.set(ideaData.category);
    this.isTodoPopupShow.set(true);
  }

  /** Schließt das Todo-Planungs-Popup und bereinigt alle transienten KI-Daten-Buffer[cite: 8, 9] */
  public closePlanningModal(): void {
    this.isTodoPopupShow.set(false);
    this.ideaToPlanTitle.set('');
    this.ideaToPlanDescription.set('');
    this.ideaToPlanCategory.set('');
  }
}