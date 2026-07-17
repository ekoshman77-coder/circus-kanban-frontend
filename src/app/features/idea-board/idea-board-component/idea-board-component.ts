import { Component, inject, signal, effect, computed } from '@angular/core';
import { Note } from '../../../core/models/note';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-idea-board',
  standalone: true,
  imports: [CommonModule,
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
export class IdeaBoardComponent {
  private noteService = inject(NoteService);
  private boardStateService = inject(IdeaSortingService);
  private userService = inject(UserService)
  private tabService = inject(TabNavigationService);
  private filterService = inject(FilterService)

  public currentFilters = signal<FilterState>({ query: '', mode: 'AND', tag: '', color: '' });

  // Formular-Zustände
  public newTitle: string = "";
  public newContent: string = "";
  public newColor: string = 'note-yellow';
  public newTag: string = "";

  // 1. 🔥 HIER LEBEN DIE VIEWMODELS: Ein internes Signal NUR für die fertigen UI-Objekte
  public viewModels = signal<NoteViewModel[]>([]);
  private viewModelCache: NoteViewModel[] = [];
  public currentNotes = computed(() => this.noteService.notesList());
  public isTodoPopupShow = signal<boolean>(false)

  // Die Zwischenspeicher für die KI-Daten
  public ideaToPlanTitle = signal<string>('');
  public ideaToPlanDescription = signal<string>('');
  public ideaToPlanCategory = signal<string>('');
  ngOnInit(): void {
    // Sobald die Ideenseite betreten wird, stellen wir die Suche fest auf 'ideas' ein!
    this.filterService.setInitialCategory('ideas');
  }

  constructor() {
    // 🛡️ DIE REAKTIVE WARTESHLEIFE: 
    // Dieser Effekt wartet, bis die Services mit dem Laden der Daten fertig sind!
    effect(() => {
      const rawNotes = this.noteService.notesList();
      console.log('👀 Liste auf dem Board:', rawNotes);
      // Erst wenn die Daten wirklich da sind, transformieren wir sie kontrolliert in ViewModels
      this.viewModelCache = rawNotes.map(note => {
        const existingVM = this.viewModelCache.find(vm => vm.note.id === note.id);
        if (existingVM) {
          existingVM.note = note; // Aktualisiert nur den Text aus der DB
          return existingVM;
        } else {
          // HIER fliegt kein NG0600 mehr, weil allowSignalWrites=true das Setzen 
          // der Pin-Farbe im ViewModel-Konstruktor ausdrücklich erlaubt!
          return new NoteViewModel(note);
        }
      });

      // Speicher für die ViewModels befüllen
      this.viewModels.set(this.viewModelCache);
    }); // 👈 Das ist das magische Schutzschild!
  }

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
    this.newTag = ""
  }

  public onNoteUpdated(updatedNote: Note): void {
    this.noteService.updateNote(updatedNote);
  }

  public onNoteDeleted(id: string): void {
    this.noteService.removeNote(id);
  }

  public onFilterChanged(newFilters: FilterState): void {
    this.currentFilters.set(newFilters);
    this.filterService.searchTerm.set(newFilters.query);
  }

  /**
     * 🔄 DER ZENTRALE DRAG & DROP VERTEILER
     */
  public onDropped(event: CdkDragDrop<any[]>): void {
    // Sektor 1: Im Mülleimer gelandet 
    if (event.container.id === 'trashList') {
      this.handleTrashDrop(event.item.data);
      return;
    }

    // Sektor 2: Im Automaten-Schlitz gelandet 
    if (event.container.id === 'calculatorList') {
      this.handleCalculatorDrop(event.item.data);
      return;
    }

    // Sektor 3: Umsortieren auf der Pinnwand 📌
    this.handleBoardSorting(event.previousIndex, event.currentIndex);
  }

  /**
   * 🗑️ Hilfsmethode: Verarbeitet das Löschen einer Note
   */
  private handleTrashDrop(data: any): void {
    const vmToDelete = data as NoteViewModel;
    if (vmToDelete && vmToDelete.note.id) {
      this.onNoteDeleted(vmToDelete.note.id);
    }
  }

  // 2. Das neue Prädikat für den Mülleimer:
  public canIdeaEnterTrash = (drag: any): boolean => {
    const vm = drag.data as NoteViewModel;
    if (!vm) return false;

    // Wir holen die ID des aktuellen Users (z.B. über dein Auth/User-System)
    const currentUserId = this.userService.getCurrentUserId();

    // Das ViewModel entscheidet eiskalt!
    return vm.canDelete(currentUserId);
  };

  /**
     * 🎰 Hilfsmethode: Schickt eine Note in die Projektkalkulation
     */
  private handleCalculatorDrop(data: any): void {
    const vmToCalculator = data as NoteViewModel;
    if (!vmToCalculator || !vmToCalculator.note.id) return;

    console.log('🎰 Münze eingeworfen für:', vmToCalculator.note.title);

    try {
      // 🗺️ NAVIGATION TRIGGERN: Übergreifend Bescheid geben
      console.log('🗺️ Schalte Tab auf Kalkulator für Idee-ID:', vmToCalculator.note.id);

      this.tabService.changeTab(BoardTab.Calculator, {
        type: 'idea',
        id: vmToCalculator.note.id
      });

    } catch (error) {
      console.error('Kritischer Fehler im Drag&Drop-Kalkulationsablauf:', error);
    }
  }

  /**
   * 📌 Hilfsmethode: Kümmert sich um die Sortierung auf dem Board
   */
  private handleBoardSorting(previousIndex: number, currentIndex: number): void {
    const currentSorted = [...this.sortedViewModels()];
    moveItemInArray(currentSorted, previousIndex, currentIndex);

    const newOrders: NoteSortOrder[] = currentSorted.map((vm, index) => ({
      noteId: vm.note.id ?? "",
      sortIndex: index
    }));

    this.boardStateService.saveSorting(newOrders);
  }

  // 🧠 DAS REVOLUTIONÄRE FILTER-PIPELINE-SYSTEM (Völlig frei von Reihenfolgen!)
  private filterPipeline = computed(() => {
    const allVMs = this.viewModels();
    const filters = this.currentFilters();

    // Da onFilterChanged den Text synchronisiert, gibt es nur noch EINE Wahrheit:
    const searchQuery = this.filterService.searchTerm().toLowerCase().trim();

    const tagFilter = filters.tag.toLowerCase().trim();
    const colorFilter = filters.color;

    // SCHRITT 1: Die vereinte Textsuche (unterstützt auch Komma-Trennung!)
    let textFiltered = [...allVMs];

    if (searchQuery) {
      // Da du vorher eine tolle Komma-Trennung hattest, behalten wir die bei!
      const searchTerms = searchQuery.split(',').map(term => term.trim()).filter(term => term.length > 0);
      textFiltered = textFiltered.filter(vm => {
        const title = vm.note.title.toLowerCase();
        const content = vm.note.content.toLowerCase();
        return filters.mode === 'AND'
          ? searchTerms.every(term => title.includes(term) || content.includes(term))
          : searchTerms.some(term => title.includes(term) || content.includes(term));
      });
    }

    // ─── AB HIER BLEIBT DEIN ALTER CODE FÜR TAGS & FARBEN ZU 100% GLEICH ───
    let forTags = [...textFiltered];
    if (colorFilter) { forTags = forTags.filter(vm => vm.note.colorType === colorFilter); }

    let forColors = [...textFiltered];
    if (tagFilter) {
      if (tagFilter === 'none') { forColors = forColors.filter(vm => !vm.note.tag || !vm.note.tag.trim()); }
      else { forColors = forColors.filter(vm => vm.note.tag && vm.note.tag.toLowerCase().includes(tagFilter)); }
    }

    let finalSelection = [...textFiltered];
    if (tagFilter) {
      if (tagFilter === 'none') { finalSelection = finalSelection.filter(vm => !vm.note.tag || !vm.note.tag.trim()); }
      else { finalSelection = finalSelection.filter(vm => vm.note.tag && vm.note.tag.toLowerCase().includes(tagFilter)); }
    }
    if (colorFilter) { finalSelection = finalSelection.filter(vm => vm.note.colorType === colorFilter); }

    return { finalSelection, dataForColors: forColors, dataForTags: forTags };
  });

  // 1. Das finale Ausgabe-Signal für das Zettel-Grid (mit Sortierung)
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

  // 2. 🏷️ Dynamische Tags (Reagiert jetzt perfekt, auch wenn eine Farbe gewählt ist!)
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

  // 3. 🌈 Dynamische Farben (Reagiert jetzt perfekt, auch wenn ein Tag gewählt ist!)
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

  public canIdeaEnterCalculator = (drag: any): boolean => {
    const vm = drag.data; // Das gezogene NoteViewModel

    // Wenn kein ViewModel da ist, verbieten wir es. Ansonsten entscheidet das VM selbst!
    return vm ? vm.canEnterCalculator() : false;
  };

  public onTagChanged(neuerTag: any): void {
    // Wir casten es hier sicherheitshalber auf einen String, 
    // damit TypeScript die Klappe hält, egal was das HTML glaubt zu sehen!
    this.newTag = String(neuerTag || '');
  }

  // 🚀 Morgen früh einfach genau so in deine idea-board-component.ts einsetzen:
  public openTodoPlanningFromIdea(ideaData: { title: string; content: string; category: string }): void {
    console.log("🎯 KI-Daten empfangen, wir füttern die Signale und öffnen das Popup!");

    // 1. Die KI-Daten in den Signalen zwischenspeichern
    this.ideaToPlanTitle.set(ideaData.title);
    this.ideaToPlanDescription.set(ideaData.content);
    this.ideaToPlanCategory.set(ideaData.category);

    // 2. Den Vorhang öffnen! (Dein Signal auf true setzen)
    this.isTodoPopupShow.set(true);
  }

  public closePlanningModal(): void {
    // 1. Das Popup schließen
    this.isTodoPopupShow.set(false);

    // 2. Die Zwischenspeicher sauber ausleeren
    this.ideaToPlanTitle.set('');
    this.ideaToPlanDescription.set('');
    this.ideaToPlanCategory.set('');
  }
}