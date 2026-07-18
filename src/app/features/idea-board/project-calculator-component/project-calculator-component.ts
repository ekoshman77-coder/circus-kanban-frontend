import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../core/services/project/project-service';
import { NoteService } from '../../../core/services/note/note-service';
import { Project } from '../../../core/models/project';
import { Milestone } from '../../../core/models/milestone';
import { BoardTab, NavigationState, TabNavigationService } from '../tab-navigation-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MilestoneSuggestionsComponent } from '../milestone-suggestions-component/milestone-suggestions-component';
import { UserService } from '../../../core/services/user/user-service';
import { ProjectDraftService } from '../../../core/services/project/project-draft-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { Note } from '../../../core/models/note';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { HttpErrorResponse } from '@angular/common/http';
import { TeamService } from '../../../core/services/team/team-service';

/**
 * @component ProjectCalculatorComponent
 * @description Kern-Komponente des Project-Calculators. Sie dient als Laborumgebung, 
 * um Meilensteine für neue Projekt-Entwürfe (Drafts) zu kalkulieren oder bestehende 
 * Projekte aus der Datenbank reaktiv zu bearbeiten.
 */
@Component({
  selector: 'app-project-calculator-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    UniversalPopupComponent,
    MilestoneSuggestionsComponent,
    MilestoneSelectorComponent
  ],
  templateUrl: './project-calculator-component.html',
  styleUrl: './project-calculator-component.css'
})
export class ProjectCalculatorComponent implements OnInit {
  // -------------------------------------------------------------------------
  // 🛠️ INJIZIERTE SERVICES
  // -------------------------------------------------------------------------
  protected projectService = inject(ProjectService);
  protected noteService = inject(NoteService);
  protected navigationService = inject(TabNavigationService);
  protected todoService = inject(TodoService);
  protected userService = inject(UserService);
  public projectDraftService = inject(ProjectDraftService);
  private notificationService = inject(NotificationService);
  private teamService = inject(TeamService);

  // -------------------------------------------------------------------------
  // 🚦 REAKTIVE ZUSTÄNDE (SIGNALS)
  // -------------------------------------------------------------------------
  
  /** Die zugrundeliegende Idee (Notiz), aus welcher der Entwurf gestartet wurde */
  public currentIdea = signal<Note | null>(null);
  
  /** Flag, ob wir ein brandneues Projekt kalkulieren (true) oder ein existierendes bearbeiten (false) */
  protected isBrandNewDraft = signal<boolean>(true);
  
  /** Zustand der KI-Vorschläge-Sidebar (offen/geschlossen) */
  protected isSidebarOpen = signal<boolean>(false);

  /** Steuert die Anzeige des Wiederherstellungs-Banners für ungespeicherte Entwürfe */
  protected showRestoreBanner = signal<boolean>(false);
  
  /** Der aus dem LocalStorage ausgelesene Titel des ungespeicherten Entwurfs */
  protected draftTitleFromStorage = signal<string>('');

  /** Formular-Zustand für den Titel eines manuell hinzuzufügenden Meilensteins */
  protected newMilestoneTitle = signal<string>('');
  
  /** Formular-Zustand für die Dauer eines manuell hinzuzufügenden Meilensteins */
  protected newMilestoneDuration = signal<number>(1);

  /** Zwischenspeicher (Labor-RAM) für die Bearbeitung eines bereits existierenden DB-Projekts */
  protected localEditProject = signal<Project | null>(null);

  /** Der Fachbereich (Tag) des Projekts zur gezielten Abfrage passender KI-Templates */
  protected suggestedArea = signal<string>('Allgemein');
  
  /** Steuert die Lade-Animation während KI-Vorschläge abgerufen werden */
  protected isMagicLoading = signal<boolean>(false);

  /** Steuert die Anzeige des Erfolgs-Popups nach Abschluss der Kalkulation */
  protected showSuccessPopup = signal<boolean>(false);
  
  /** Hält den finalen Projekttitel für die Anzeige im Erfolgs-Popup bereit */
  protected finalProjectTitle = signal<string>('');

  /** Die ID des Meilensteins, der sich aktuell im Inline-Edit-Modus befindet (null falls keiner) */
  protected editingMilestoneId: string | null = null;
  
  /** Temporärer Titel während des Inline-Edits */
  protected editTitle: string = '';
  
  /** Temporäre Dauer während des Inline-Edits */
  protected editTime: number = 1;
  
  /** Array von 1 bis 30 für die Dropdown-Auswahl der Meilenstein-Tage */
  public availableDays: number[] = Array.from({ length: 30 }, (_, i) => i + 1);

  /** Merkt sich den Ursprungs-Tab, um den User beim Abbrechen wieder dorthin zurückzuschicken */
  protected originTab = signal<BoardTab | null>(null);

  // -------------------------------------------------------------------------
  // 🧮 COMPUTED SIGNALS (REAKTIVE ABLEITUNGEN)
  // -------------------------------------------------------------------------

  /** 
   * 🌟 DIE EINZIGE LESE-BRILLE FÜR DAS HTML
   * Schaltet je nach Modus automatisch zwischen dem globalen Draft-Signal und dem lokalen Labor-Projekt um.
   */
  public activeProject = computed<Project | null>(() => {
    return this.isBrandNewDraft() ? this.projectDraftService.currentDraft() : this.localEditProject();
  });

  /** 
   * Berechnet vollautomatisch die summierten Gesamttage aller Meilensteine des aktiven Projekts.
   */
  public finalDays = computed(() => {
    const proj = this.activeProject();
    if (!proj || !proj.milestones) return 0;
    return proj.milestones.reduce((sum, ms) => sum + (+ms.duration || 0), 0);
  });

  /**
   * 🎯 DIE REAKTIVE WEICHE FÜR SCHREIBZUGRIFFE
   * Gibt das aktuell beschreibbare Signal zurück, auf dem Änderungen angewendet werden müssen.
   */
  private getActiveSignal() {
    return this.isBrandNewDraft() ? this.projectDraftService.currentDraft : this.localEditProject;
  }

  // -------------------------------------------------------------------------
  // 🏗️ CONSTRUCTOR & LIFECYCLE HOOKS
  // -------------------------------------------------------------------------
  
  constructor() {
    /**
     * Reagiert autark auf Änderungen des Navigation-States und steuert den internen State
     * der Komponente (ob eine Idee, ein Projekt geladen oder der nackte Tab geklickt wurde).
     */
    effect(() => {
      const navState = this.navigationService.currentNavigationState();
      const userId = this.userService.getCurrentUserId();

      if (!userId || navState === null) return;

      if (navState.type === 'tab-click') {
        this.originTab.set(BoardTab.Calculator);
        this.isBrandNewDraft.set(true);
      } else if (navState.type === 'idea') {
        this.originTab.set(BoardTab.Pinboard);
      } else if (navState.type === 'project') {
        this.originTab.set(BoardTab.Projects);
      }

      this.handleNavigationStateChange(navState, userId);
    });
  }

  ngOnInit(): void {
    this.projectService.loadProjects();
  }

  /**
   * Verarbeitet die Navigations-Daten und entscheidet, ob Daten geladen, überschrieben 
   * oder ein Wiederherstellungsbanner eingeblendet werden muss.
   */
  private handleNavigationStateChange(navState: NavigationState, userId: string): void {
    if (navState.type === 'tab-click') {
      const hasDraft = this.projectDraftService.hasExistingDraftInStorage(userId);
      const isSignalEmpty = !this.projectDraftService.currentDraft();

      if (hasDraft && isSignalEmpty && !this.localEditProject()) {
        const cachedTitle = this.projectDraftService.getDraftTitleFromStorage(userId);
        this.draftTitleFromStorage.set(cachedTitle || 'Untitled Project');
        this.showRestoreBanner.set(true);
      } else {
        this.showRestoreBanner.set(false);
      }
    }
    else if (navState.type === 'idea') {
      this.isBrandNewDraft.set(true);
      this.localEditProject.set(null);
      this.showRestoreBanner.set(false);

      const foundIdea = this.noteService.notesList().find((n) => n.id === navState.id);
      if (foundIdea) {
        this.currentIdea.set(foundIdea);
        const cachedTitle = this.projectDraftService.getDraftTitleFromStorage(userId);

        if (cachedTitle && cachedTitle.trim().toLowerCase() === foundIdea.title.trim().toLowerCase()) {
          this.projectDraftService.loadDraftFromStorageIntoSignal();
        } else {
          this.projectDraftService.initDraftFromIdea(foundIdea);
        }
        this.suggestedArea.set(foundIdea.tag || 'Allgemein');
      }
    }
    else if (navState.type === 'project') {
      this.isBrandNewDraft.set(false);
      this.currentIdea.set(null);
      this.showRestoreBanner.set(false);

      const matchingProject = this.projectService.projectsList().find((p) => p.id === navState.id);
      if (matchingProject) {
        this.localEditProject.set(new Project({
          ...matchingProject,
          milestones: [...(matchingProject.milestones || [])]
        }));
        this.suggestedArea.set(matchingProject.area || 'Allgemein');
      }
    }

    this.navigationService.currentNavigationState.set(null);
  }

  // -------------------------------------------------------------------------
  // 🔥 WEICHENLOSE MUTATIONS-METHODEN (BUSINESS-LOGIK)
  // -------------------------------------------------------------------------

  /**
   * Fügt dem aktiven Projekt einen neuen Meilenstein hinzu, fängt Duplikate ab 
   * und triggert den Akzeptanz-Lerneffekt für das KI-Modell.
   */
  public onMilestoneAdded(milestoneTitle: string, customDuration?: number): void {
    const targetSignal = this.getActiveSignal();
    const currentProject = targetSignal();
    if (!currentProject) return;

    const trimmedTitle = milestoneTitle.trim();
    if (!trimmedTitle) return;

    const currentMilestones = currentProject.milestones ? [...currentProject.milestones] : [];
    if (currentMilestones.some(ms => ms.title.toLowerCase().trim() === trimmedTitle.toLowerCase())) return;

    let nextIndex = 0;
    if (currentMilestones.length > 0) {
      nextIndex = Math.max(...currentMilestones.map(m => m.orderIndex || 0)) + 1;
    }

    const finalDuration = (customDuration !== undefined && customDuration > 0) ? customDuration : 1;

    const newMilestone = new Milestone({
      title: trimmedTitle,
      duration: finalDuration,
      usedDuration: 0,
      status: 'Offen',
      orderIndex: nextIndex,
      // @ts-ignore
      isNew: true
    });

    targetSignal.set(new Project({
      ...currentProject,
      milestones: [...currentMilestones, newMilestone]
    }));

    this.projectService.acceptSuggestion(currentProject.title, trimmedTitle);
  }

  /**
   * Liest das manuelle Meilenstein-Formular aus und leitet die Daten an die Kern-Add-Methode weiter.
   */
  public addNewMilestoneFromForm(): void {
    const titel = this.newMilestoneTitle().trim();
    const tage = this.newMilestoneDuration();
    if (!titel) return;

    this.onMilestoneAdded(titel, tage);
    this.newMilestoneTitle.set('');
    this.newMilestoneDuration.set(1);
  }

  /**
   * Entfernt einen Meilenstein anhand seines Index aus dem aktiven Projekt 
   * und meldet den "Abwertungs-Lerneffekt" (Degradation) an das KI-Backend.
   */
  public onMilestoneRemoved(index: number): void {
    const targetSignal = this.getActiveSignal();
    const currentProject = targetSignal();
    if (!currentProject || !currentProject.milestones) return;

    const milestoneToDegrade = currentProject.milestones[index];
    if (!milestoneToDegrade) return;

    const updatedMilestones = [...currentProject.milestones];
    updatedMilestones.splice(index, 1);

    targetSignal.set(new Project({
      ...currentProject,
      milestones: updatedMilestones
    }));

    this.projectService.degradeSuggestion(currentProject.title, milestoneToDegrade.title);
  }

  /**
   * Verarbeitet das Drag&Drop Event von Angular CDK, ordnet die Meilensteine im Array 
   * neu an und berechnet alle 'orderIndex'-Eigenschaften frisch.
   */
  public onMilestoneDropped(event: CdkDragDrop<Milestone[]>): void {
    const targetSignal = this.getActiveSignal();
    const currentProject = targetSignal();
    if (!currentProject || !currentProject.milestones) return;
    if (event.previousIndex === event.currentIndex) return;

    const updatedMilestones = [...currentProject.milestones];
    moveItemInArray(updatedMilestones, event.previousIndex, event.currentIndex);
    updatedMilestones.forEach((ms, idx) => ms.orderIndex = idx);

    targetSignal.set(new Project({
      ...currentProject,
      milestones: updatedMilestones
    }));
  }

  /**
   * Ändert die geplante Dauer eines spezifischen Meilensteins im aktiven Signal.
   */
  public onMilestoneDurationChanged(index: number, newDuration: number): void {
    const targetSignal = this.getActiveSignal();
    const currentProject = targetSignal();
    if (!currentProject || !currentProject.milestones || !currentProject.milestones[index]) return;

    const finalDuration = newDuration > 0 ? newDuration : 1;

    const updatedMilestones = currentProject.milestones.map((ms, i) => {
      if (i === index) return new Milestone({ ...ms, duration: finalDuration });
      return ms;
    });

    targetSignal.set(new Project({
      ...currentProject,
      milestones: updatedMilestones
    }));
  }

  /**
   * Ändert den Titel eines spezifischen Meilensteins im aktiven Signal.
   */
  public onMilestoneTitleChanged(index: number, newTitle: string): void {
    const targetSignal = this.getActiveSignal();
    const currentProject = targetSignal();
    if (!currentProject || !currentProject.milestones || !currentProject.milestones[index]) return;

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    const updatedMilestones = currentProject.milestones.map((ms, i) => {
      if (i === index) return new Milestone({ ...ms, title: trimmedTitle });
      return ms;
    });

    targetSignal.set(new Project({
      ...currentProject,
      milestones: updatedMilestones
    }));
  }

  /**
   * Speichert den veränderten Titel und die geänderte Dauer eines Meilensteins 
   * nach dem Inline-Editing gleichzeitig ab und schließt den Bearbeitungsmodus.
   */
  public saveInlineEdit(index: number): void {
    const targetSignal = this.getActiveSignal();
    const currentProject = targetSignal();
    if (!currentProject || !currentProject.milestones || !currentProject.milestones[index]) {
      this.editingMilestoneId = null;
      return;
    }

    const trimmedTitle = this.editTitle.trim();
    if (!trimmedTitle) {
      this.editingMilestoneId = null;
      return;
    }

    const validatedMilestoneDuration = this.editTime > 0 ? this.editTime : 1;

    const updatedMilestones = currentProject.milestones.map((ms, i) =>
      i === index ? new Milestone({ ...ms, title: trimmedTitle, duration: validatedMilestoneDuration }) : ms
    );

    targetSignal.set(new Project({
      ...currentProject,
      milestones: updatedMilestones
    }));

    this.editingMilestoneId = null;
    this.editTitle = '';
  }

  // -------------------------------------------------------------------------
  // 🖼️ UI EVENT HANDLER (BANNER, SIDEBAR & INTERAKTIONEN)
  // -------------------------------------------------------------------------

  /** Stellt den ungespeicherten Entwurf aktiv aus dem Storage wieder her */
  public restoreDraftFromBanner(): void {
    this.isBrandNewDraft.set(true);
    this.projectDraftService.loadDraftFromStorageIntoSignal();
    const geladenerDraft = this.projectDraftService.currentDraft();
    if (geladenerDraft) {
      this.suggestedArea.set(geladenerDraft.area || 'Allgemein');
      if (geladenerDraft.ideaId) {
        const passendeIdee = this.noteService.notesList().find(n => n.id === geladenerDraft.ideaId);
        if (passendeIdee) this.currentIdea.set(passendeIdee);
      }
    }
    this.showRestoreBanner.set(false);
  }

  /** Verwürft den Entwurf im Speicher dauerhaft und schließt das Banner */
  public rejectDraftFromBanner(): void {
    this.projectDraftService.clearDraft();
    this.showRestoreBanner.set(false);
  }

  /** Aktiviert den Bearbeitungsmodus (Labor-Modus) für ein existierendes Projekt */
  public onProjectSelectedFromWelcome(id: string): void {
    this.isBrandNewDraft.set(false);
    this.currentIdea.set(null);
    this.showRestoreBanner.set(false);

    const passendesProjekt = this.projectService.projectsList().find((p) => p.id === id);
    if (passendesProjekt) {
      this.localEditProject.set(new Project({
        ...passendesProjekt,
        milestones: [...passendesProjekt.milestones]
      }));
    }
  }

  /** Öffnet oder schließt die KI-Vorschläge-Sidebar */
  public toggleSidebar(): void {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  /**
   * Bricht die aktuelle Kalkulation komplett ab, putzt bei Bedarf den LocalStorage 
   * und leitet den Anwender sicher auf seinen Ursprungstab zurück.
   */
  public cancelAndDiscardDraft(): void {
    if (this.isBrandNewDraft()) {
      this.projectDraftService.clearDraft();
      this.currentIdea.set(null);
    } else {
      this.localEditProject.set(null);
    }

    this.isBrandNewDraft.set(true);

    if (this.originTab() === BoardTab.Pinboard) {
      this.navigationService.changeTab(BoardTab.Pinboard, { type: 'idea', id: "" });
    } else {
      this.navigationService.changeTab(BoardTab.Projects, { type: 'project', id: "" });
    }
    this.originTab.set(null);
  }

  /** Öffnet das finale Bestätigungs-Popup zur Speicherung auf dem Server */
  public finishCalculation(): void {
    const project = this.activeProject();
    if (!project) return;
    this.finalProjectTitle.set(project.title);
    this.showSuccessPopup.set(true);
  }

  /** Validiert, ob das Projekt Meilensteine besitzt und ob der User Schreibrechte besitzt */
  public canSaveCalculation(): boolean {
    const project = this.activeProject();
    if (!project || !project.milestones || project.milestones.length === 0) return false;
    if (!this.isBrandNewDraft()) {
      return this.teamService.hasPermission(project.id, 'PROJECT_EDIT');
    }
    return true;
  }

  /** Schickt den Projekttitel an das Bayes-Backend ab, um passende Template-Vorschläge zu generieren */
  public applySmartTemplates(): void {
    const proj = this.activeProject();
    if (!proj || !proj.title) return;
    this.isMagicLoading.set(true);
    this.projectService.loadMilestoneSuggestions(proj.title, this.suggestedArea());
    setTimeout(() => this.isMagicLoading.set(false), 800);
  }

  /** Logger für Sichtbarkeitsänderungen abgelehnter Meilensteine */
  public degradedAreShown(event: any): void {
    console.log('Sichtbarkeit geändert:', event);
  }

  /**
   * Schickt das fertige Rechenergebnis per HTTP-Request an das Backend. 
   * Löscht bei Erfolg lokale Entwurfsdaten und wechselt reaktiv in die Projektübersicht.
   */
  public handleAutoSaveConfirm(): void {
    const project = this.activeProject();
    if (!project || !project.milestones || project.milestones.length === 0) {
      this.notificationService.showNotification('Keine Daten vorhanden! 🛑', 'error');
      this.showSuccessPopup.set(false);
      return;
    }

    if (!this.isBrandNewDraft()) {
      const currentUserId = this.userService.getCurrentUserId();
      if (project.userId !== currentUserId) {
        this.notificationService.showNotification('Keine Berechtigung! 🛑', 'error');
        this.showSuccessPopup.set(false);
        return;
      }
    }

    const saveObservable = this.isBrandNewDraft()
      ? this.projectService.saveCalculatedProject(project)
      : (this.projectService as any).updateProject?.(project) || this.projectService.saveCalculatedProject(project);

    saveObservable.subscribe({
      next: () => {
        const erfolgsNachricht = this.isBrandNewDraft()
          ? `Projekt "${project.title}" wurde erfolgreich gestartet! 🚀`
          : `Änderungen am Projekt "${project.title}" wurden gespeichert! 💾`;

        this.notificationService.showNotification(erfolgsNachricht, 'success');

        if (this.isBrandNewDraft()) {
          this.projectDraftService.clearDraft();
          this.currentIdea.set(null);
        } else {
          this.localEditProject.set(null);
        }

        this.isBrandNewDraft.set(true);
        this.showSuccessPopup.set(false);
        this.navigationService.changeTab(BoardTab.Projects, { type: 'project', id: "" });
      },
      error: (err: HttpErrorResponse) => {
        const serverMessage = err.error?.message || 'Fehler beim Speichern!';
        this.notificationService.showNotification(serverMessage, 'error');
        this.showSuccessPopup.set(false);
      }
    });
  }

  /** Schließt das Bestätigungs-Popup ohne zu speichern */
  public cancelPopupCountdown(): void {
    this.showSuccessPopup.set(false);
  }

  /** Aktiviert den Inline-Edit-Modus für eine bestimmte Meilenstein-Zeile */
  public startEditMilestone(task: Milestone): void {
    this.editingMilestoneId = task.id;
    this.editTitle = task.title;
    this.editTime = task.duration || 1;
  }

  /** Bricht das Inline-Editing ab und bereinigt die Formular-Buffer */
  public cancelEditMilestone(): void {
    this.editingMilestoneId = null;
    this.editTitle = '';
    this.editTime = 1;
  }

  // -------------------------------------------------------------------------
  // 🔄 HTML-ALIAS METHODEN (VOM TEMPLATE BENÖTIGT)
  // -------------------------------------------------------------------------

  /**
   * @deprecated Nutze stattdessen bevorzugt cancelAndDiscardDraft() direkt.
   * Alias-Methode fürs HTML, um die aktuelle Kalkulation abzubrechen.
   */
  public abortCalculation(): void {
    this.cancelAndDiscardDraft();
  }

  /**
   * @deprecated Nutze stattdessen bevorzugt onMilestoneDropped($event) direkt.
   * Alias-Methode fürs HTML, um das Drag&Drop-Event der Meilensteine zu verarbeiten.
   */
  public onDrop(event: any): void {
    this.onMilestoneDropped(event);
  }
}