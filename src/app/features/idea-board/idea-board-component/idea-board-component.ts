import { Component, inject, signal, effect, computed, OnInit, input } from '@angular/core';
import { Note } from '../../../core/models/note';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { NoteComponent } from '../note-component/note-component';
import { NoteService } from '../../../core/services/note/note-service';
import { NoteViewModel } from '../../../core/viewmodel/note-view-model';
import { IdeaSortingService } from '../../../core/services/note/idea-sorting-service';
import { NoteSortOrder } from '../../../core/models/note-sort-order';
import { BoardFilterComponent, FilterState } from '../../../core/shared/components/board-filter-component/board-filter-component';
import { NotesStatisticsComponent } from '../notes-statistics-component/notes-statistics-component';
import { TabNavigationService } from '../tab-navigation-service';
import { BoardTab } from '../tab-navigation-service';
import { NoteInputComponent } from '../note-input-component/note-input-component';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TodoPlanningModalComponent } from '../../../core/shared/components/todo-planning-modal-component/todo-planning-modal-component';
import { UserService } from '../../../core/services/user/user-service';
import { ProjectService } from '../../../core/services/project/project-service';
import { AssignProjectManagerModalComponent, CreateProjectPayload } from '../../../core/shared/components/assigment-project-manager-modal/assigment-project-manager-modal';
import { Project } from '../../../core/models/project';
import { TeamService } from '../../../core/services/team/team-service';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { generateLocalId } from '../../../core/shared/constants/id-const';

export type BoardMode = 'USER_BOARD' | 'ADMIN_DEPARTMENTS' | 'ADMIN_COMPANY';

/**
 * @component IdeaBoardComponent
 * @description Die digitale Magnettafel unseres Systems. Verwaltet das Erstellen, Filtern, 
 * Sortieren und Verteilen von Notizen (Ideen) via Drag & Drop in den Kalkulator-Schlitz oder den Mülleimer.
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
    AssignProjectManagerModalComponent
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
  private projectService = inject(ProjectService)
  private teamService = inject(TeamService)
  private notificationService = inject(NotificationService);

  public mode = input<BoardMode>('USER_BOARD');
  /** Interne Sortier-Orders für diesen spezifischen Kontext */
  public sortOrders = signal<NoteSortOrder[]>([]);

  public selectedNoteForProject = signal<Note | null>(null);
  // -------------------------------------------------------------------------
  // 🚦 REAKTIVE ZUSTÄNDE (SIGNALS)
  // -------------------------------------------------------------------------

  /** 🟢 Liefert dynamisch nur die IDs der Zonen, die im jeweiligen Modus gerendert werden */
  public connectedDropLists = computed(() => {
    const currentMode = this.mode();

    switch (currentMode) {
      case 'USER_BOARD':
        // User-Board hat Trash und Calculator
        return ['trashList', 'calculatorList'];

      case 'ADMIN_COMPANY':
        // Admin Company hat Revert (ID: trashList) und Project (ID: calculatorList)
        return ['trashList', 'calculatorList'];

      case 'ADMIN_DEPARTMENTS':
      default:
        // Admin Department hat NUR den Promote-Schlitz rechts! (Keine Trash-Zone links)
        return ['calculatorList'];
    }
  });

  /** Der aktuell aktive Filterzustand (Suchbegriff, Verknüpfungsmodus, Tag, Farbe) */
  public currentFilters = signal<FilterState>({ query: '', mode: 'AND', tag: '', color: '' });

  /** Formular-Zustand: Titel einer manuell via Fallback erstellten Notiz */
  public newTitle: string = "";
  /** Formular-Zustand: Inhalt einer manuell via Fallback erstellten Notiz */
  public newContent: string = "";
  /** Formular-Zustand: Kartenfarbe einer manuell via Fallback erstellten Notiz */
  public newColor: string = 'note-yellow';
  /** Formular-Zustand: Tag/Fachbereich einer manuell via Fallback erstellten Notiz */
  public newTag: string = "";

  /** 🌟 UI-EXKLUSIVER ZUSTAND: Hält die transformierten und angereicherten Notizen-Ausstellungsstücke (ViewModels) */
  public viewModels = signal<NoteViewModel[]>([]);

  /** Interner Cache, um bestehende ViewModels bei Daten-Updates reaktiv zu recyclen */
  private viewModelCache: NoteViewModel[] = [];

  /** 🟢 NEU: Filtert die rohen Notizen dynamisch je nach Modus */
  public currentNotes = computed(() => {
    const allNotes = this.noteService.notesList();
    const mode = this.mode();

    // 1. Nach Board-Modus / Scope filtern
    let modeFiltered = allNotes;
    switch (mode) {
      case 'ADMIN_DEPARTMENTS':
        modeFiltered = allNotes.filter(n => n.scope === 'DEPARTMENT');
        break;
      case 'ADMIN_COMPANY':
        modeFiltered = allNotes.filter(n => n.scope === 'COMPANY');
        break;
      case 'USER_BOARD':
      default:
        modeFiltered = allNotes;
        break;
    }

    // 2. 🟢 Ideen ausblenden, die aktuell in Verarbeitung/Kalkulation sind
    return modeFiltered.filter(note => !note.isInCalculation);
  });

  /** Steuert die Anzeige des Todo-Planungs-Modal-Popups */
  public isTodoPopupShow = signal<boolean>(false);

  /** KI-Zwischenspeicher: Titel der Idee, die in ein Todo konvertiert werden soll */
  public ideaToPlanTitle = signal<string>('');
  /** KI-Zwischenspeicher: Beschreibung der Idee, die in ein Todo konvertiert werden soll */
  public ideaToPlanDescription = signal<string>('');
  /** KI-Zwischenspeicher: Vorgeschlagene Kategorie für das geplante Todo */
  public ideaToPlanCategory = signal<string>('');

  // -------------------------------------------------------------------------
  // 🏗️ LIFECYCLE & EFFECT-WARTESHLEIFE
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    this.filterService.setInitialCategory('ideas');

    // 🟢 NEU: Lädt die Sortierung spezifisch für diesen Modus/Kontext
    const savedOrders = this.boardStateService.loadSorting(this.mode());
    this.sortOrders.set(savedOrders);
  }

  constructor() {
    effect(() => {
      // 🟢 Greift jetzt reaktiv auf currentNotes() basierend auf dem mode zu
      const rawNotes = this.currentNotes();

      this.viewModelCache = rawNotes.map(note => {
        const existingVM = this.viewModelCache.find(vm => vm.note.id === note.id);
        if (existingVM) {
          existingVM.note = note;
          return existingVM;
        } else {
          return new NoteViewModel(note);
        }
      });

      this.viewModels.set(this.viewModelCache);
    });
    effect(() => {
      const currentMode = this.mode();
      const savedOrders = this.boardStateService.loadSorting(currentMode);
      this.sortOrders.set(savedOrders);
      this.filterService.resetData();
    });
  }

  // -------------------------------------------------------------------------
  // 📌 NOTIZ-AKTIONEN (CRUD)
  // -------------------------------------------------------------------------

  /** Erstellt eine neue Notiz direkt über das Board-Eingabefeld */
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

  /** Leitet Aktualisierungen an einer Notiz (z.B. Textänderung) an den Service weiter */
  public onNoteUpdated(updatedNote: Note): void {
    this.noteService.updateNote(updatedNote);
  }

  /** Löscht eine spezifische Notiz permanent aus dem System */
  public onNoteDeleted(id: string): void {
    this.noteService.removeNote(id);
  }

  /** Verarbeitet Filteränderungen aus der UI und synchronisiert sie mit dem Suchbegriff-Service */
  public onFilterChanged(newFilters: FilterState): void {
    this.currentFilters.set(newFilters);
    this.filterService.searchTerm.set(newFilters.query);
  }

  // -------------------------------------------------------------------------
  // 🔄 DRAG & DROP LOGIK
  // -------------------------------------------------------------------------

  /**
   * 🔄 DER ZENTRALE DRAG & DROP VERTEILER
   * Entscheidet anhand der Ziel-Container-ID, ob gelöscht, kalkuliert oder sortiert wird.
   */
  public onDropped(event: CdkDragDrop<any[]>): void {
    const vm = event.item.data as NoteViewModel;
    if (!vm || !vm.note.id) return;

    // A: In die linke Dropzone gezogen
    if (event.container.id === 'trashList') {
      if (this.mode() === 'USER_BOARD') {
        this.handleTrashDrop(vm);
      } else if (this.mode() === 'ADMIN_COMPANY') {
        // ↩️ Zurückstufen auf Department-Scope
        this.noteService.revertToDepartment(vm.note.id);
        this.notificationService.showNotification(`Idee "${vm.note.title}" wurde an die Abteilung zurückgesendet.`, 'info');
      }
      return;
    }

    // B: In den rechten Schlitz gezogen
    if (event.container.id === 'calculatorList') {
      if (this.mode() === 'USER_BOARD') {
        this.handleCalculatorDrop(vm);
      } else if (this.mode() === 'ADMIN_DEPARTMENTS') {
        console.log("Note geht zum Promoting", vm.note)
        // 🚀 Auf Company-Ebene heben
        this.noteService.promoteToCompany(vm.note.id);
        this.notificationService.showNotification(`Idee "${vm.note.title}" wurde auf Company-Ebene gehoben! 🚀`, 'success');
      } else if (this.mode() === 'ADMIN_COMPANY') {
        console.log('🚀 Open Modal for Note:', vm.note);
        // 🎯 Checking-Slot: Modal für PM-Auswahl & Projekt-Erstellung öffnen
        this.openProjectCreationModal(vm);
      }
      return;
    }

    // C: Umsortieren auf der Pinnwand
    this.handleBoardSorting(event.previousIndex, event.currentIndex);
  }

  public openProjectCreationModal(vm: NoteViewModel): void {
    console.log("openProjectCreationModal: vm-note ", vm)
    this.selectedNoteForProject.set(vm.note);
  }

  // Event vom Modal behandeln:
// Event vom Modal behandeln:
// Event vom Modal behandeln:
  public handleProjectCreation(payload: CreateProjectPayload): void {
    if (!this.selectedNoteForProject()) {
      return;
    }
    const idea = this.selectedNoteForProject();
    
    // 1. Projekt-Modell mit temporärer Local-ID instanziieren
    const newProject = new Project({
      id: generateLocalId(),
      title: payload.title,
      ideaId: idea?.id ?? '',
      area: 'Default',
      userId: this.userService.getCurrentUserId() ?? '',
      departmentId: idea?.departmentId ?? '',
      status: 'Calculation',
      scope: 'COMPANY',
      teamMembers: []
    });

    // 2. Projekt speichern (Sync void Call)
    this.projectService.saveCalculatedProject(newProject);

    // 3. Projektleiter suchen und dem neu erstellten Projekt zuweisen
    const pmMember = this.teamService.globalMembersSignal().find(member => member.user.id === payload.projectManagerId);

    if (pmMember) {
      this.projectService.addMemberToProject(
        newProject.id,
        pmMember.user,
        'PROJECT_MANAGER'
      );
      this.notificationService.showNotification(
        `Projekt "${newProject.title}" wurde erfolgreich erstellt und ${pmMember.user.firstName} ${pmMember.user.lastName} als PM zugewiesen!`,
        'success'
      );
    } else {
      this.notificationService.showNotification(
        `Projekt "${newProject.title}" wurde ohne zugewiesenen PM erstellt.`,
        'info'
      );
    }

    // Modal schließen
    this.selectedNoteForProject.set(null);
  }
    
  /** Verarbeitet das Hineinwerfen einer Karte in die Mülltonne */
  private handleTrashDrop(data: any): void {
    const vmToDelete = data as NoteViewModel;
    if (vmToDelete && vmToDelete.note.id) {
      this.onNoteDeleted(vmToDelete.note.id);
    }
  }

  /** 
   * 🛡️ MÜLLEIMER-PRÄDIKAT
   * Prüft in Echtzeit vor dem Drop, ob der aktuelle User die Berechtigung besitzt, diese Idee zu löschen.
   */
  public canIdeaEnterTrash = (drag: any): boolean => {
    const vm = drag.data as NoteViewModel;
    if (!vm) return false;
    const currentUserId = this.userService.getCurrentUserId();
    return vm.canDelete(currentUserId);
  };

  /** 
   * 🎰 AUTOMATEN-DROP
   * Wirft die Idee in den vertikalen Schlitz und triggert den Tab-Wechsel in das Kalkulator-Labor.
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

  /** Ändert die Reihenfolge der Elemente direkt auf dem Board und speichert den neuen Index permanent */
  private handleBoardSorting(previousIndex: number, currentIndex: number): void {
    const currentSorted = [...this.sortedViewModels()];
    moveItemInArray(currentSorted, previousIndex, currentIndex);

    const newOrders: NoteSortOrder[] = currentSorted.map((vm, index) => ({
      noteId: vm.note.id ?? "",
      sortIndex: index
    }));

    // 🟢 Aktualisiert lokales Signal & speichert mit contextKey = this.mode
    this.sortOrders.set(newOrders);
    this.boardStateService.saveSorting(this.mode(), newOrders);
  }

  // -------------------------------------------------------------------------
  // 🧠 REVOLUTIONÄRES FILTER-PIPELINE-SYSTEM
  // -------------------------------------------------------------------------

  /**
   * 🔀 DIE FILTER-PIPELINE
   * Rechnet völlig unabhängig von der Ausführungsreihenfolge Text-, Farb- und Tag-Schnittmengen aus.
   * Eliminiert Seiteneffekte und stellt Daten kreuzweise für dynamische Dropdowns bereit[.
   */
  private filterPipeline = computed(() => {
    const allVMs = this.viewModels();
    const filters = this.currentFilters();
    const searchQuery = this.filterService.searchTerm().toLowerCase().trim();
    const tagFilter = filters.tag.toLowerCase().trim();
    const colorFilter = filters.color;

    let textFiltered = [...allVMs];

    // Multi-Term-Textsuche mit Komma-Trennung (unterstützt AND/OR Verknüpfungen)
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

    // Teilstrom für dynamische Tags (berücksichtigt Text- und Farbfilter)
    let forTags = [...textFiltered];
    if (colorFilter) { forTags = forTags.filter(vm => vm.note.colorType === colorFilter); }

    // Teilstrom für dynamische Farben (berücksichtigt Text- und Tagfilter)
    let forColors = [...textFiltered];
    if (tagFilter) {
      if (tagFilter === 'none') { forColors = forColors.filter(vm => !vm.note.tag || !vm.note.tag.trim()); }
      else { forColors = forColors.filter(vm => vm.note.tag && vm.note.tag.toLowerCase().includes(tagFilter)); }
    }

    // Finales Ergebnis nach Anwendung aller Filterkriterien
    let finalSelection = [...textFiltered];
    if (tagFilter) {
      if (tagFilter === 'none') { finalSelection = finalSelection.filter(vm => !vm.note.tag || !vm.note.tag.trim()); }
      else { finalSelection = finalSelection.filter(vm => vm.note.tag && vm.note.tag.toLowerCase().includes(tagFilter)); }
    }
    if (colorFilter) { finalSelection = finalSelection.filter(vm => vm.note.colorType === colorFilter); }

    return { finalSelection, dataForColors: forColors, dataForTags: forTags };
  });

  /** 📊 Das finale, sortierte Ausgabe-Signal für das Zettel-Grid */
  public sortedViewModels = computed(() => {
    const { finalSelection } = this.filterPipeline();
    const orders = this.sortOrders();

    if (orders.length === 0) return finalSelection;
    return [...finalSelection].sort((a, b) => {
      const indexA = orders.find(o => o.noteId === a.note.id)?.sortIndex ?? 999;
      const indexB = orders.find(o => o.noteId === b.note.id)?.sortIndex ?? 999;
      return indexA - indexB;
    });
  });

  /** 🏷️ Berechnet dynamisch alle verfügbaren Tags basierend auf den aktiven Filtern */
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

  /** 🌈 Berechnet dynamisch alle verfügbaren Kartenfarben basierend auf den aktiven Filtern */
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

  /** 🛡️ KALKULATOR-PRÄDIKAT: Validiert vor dem Drop, ob eine Idee kalkuliert werden darf */
  public canIdeaEnterCalculator = (drag: any): boolean => {
    const vm = drag.data;
    return vm ? vm.canEnterCalculator() : false;
  };

  /** Hilfsmethode zur String-Validierung bei Tag-Wechseln */
  public onTagChanged(neuerTag: any): void {
    this.newTag = String(neuerTag || '');
  }

  // -------------------------------------------------------------------------
  // 🔮 KI INTERAKTION & MODAL MANAGEMENT
  // -------------------------------------------------------------------------

  /** Öffnet das Todo-Planungs-Popup und injiziert die von der KI vorgeschlagenen strukturierten Daten */
  public openTodoPlanningFromIdea(ideaData: { title: string; content: string; category: string }): void {
    console.log("🎯 KI-Daten empfangen, wir füttern die Signale und öffnen das Popup!");
    this.ideaToPlanTitle.set(ideaData.title);
    this.ideaToPlanDescription.set(ideaData.content);
    this.ideaToPlanCategory.set(ideaData.category);
    this.isTodoPopupShow.set(true);
  }

  /** Schließt das Todo-Planungs-Popup und bereinigt alle transienten KI-Daten-Buffer */
  public closePlanningModal(): void {
    this.isTodoPopupShow.set(false);
    this.ideaToPlanTitle.set('');
    this.ideaToPlanDescription.set('');
    this.ideaToPlanCategory.set('');
  }
}