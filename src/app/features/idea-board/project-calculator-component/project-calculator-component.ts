import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../core/services/project-service';
import { NoteService } from '../../../core/services/note-service';
import { Project } from '../../../core/models/project';
import { Milestone } from '../../../core/models/milestone';
import { NavigationState, TabNavigationService } from '../tab-navigation-service';
import { BoardTab } from '../tab-navigation-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MILESTONE_TEMPLATES, TemplateMilestone } from '../../../core/shared/constants/milestone-template';
import { I } from '@angular/cdk/keycodes';
import { BoardFilterState } from '../team-board-component/team-board-component';
import { MilestoneSuggestionsComponent } from '../milestone-suggestions-component/milestone-suggestions-component';
import { DraftProjectWrapper } from '../../../core/models/draft-project-wrapper';
import { TeamService } from '../../../core/services/team-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-project-calculator-component',
  standalone: true,
  imports: [CommonModule, FormsModule, UniversalPopupComponent, DragDropModule, MilestoneSuggestionsComponent, MilestoneSelectorComponent],
  templateUrl: './project-calculator-component.html',
  styleUrl: './project-calculator-component.css',
})
export class ProjectCalculatorComponent implements OnInit {
  public projectService = inject(ProjectService);
  public noteService = inject(NoteService);
  private tabService = inject(TabNavigationService);
  public teamService = inject(TeamService)

  // Reaktive Zustände für das Erfolgs-Popup
  public showSuccessPopup = signal(false);
  public finalProjectTitle = signal('');
  public finalDays = signal(0);
  public isMagicLoading = signal<boolean>(false);
  // Signal, ob die Ideen-Seitenleiste offen ist
  public isSidebarOpen = signal<boolean>(false);
  // Formular-Zustände für neue Aufgaben
  public taskTitle: string = '';
  public taskTime: number | null = null;
  private readonly MAX_DURATION_DAYS = 10;
  public minTaskTime: number = 1; //  Startet standardmäßig mit 1 Tag!

  public availableDays: number[] = Array.from({ length: this.MAX_DURATION_DAYS }, (_, i) => i + 1);
  private projectToSend: Project | null = null;

  // 💡 Banner-Signal: Steuert, ob die Einladungskarte (Fall 1a) angezeigt wird
  public showRestoreBanner = signal<boolean>(false);

  // Ein eigenes, internes Signal NUR für das Editieren eines echten Projekts
  private localEditProject = signal<Project | null>(null);

  // Die reaktive Lese-Brille für die gesamte Komponente:
  // Schnappt sich automatisch das editierte Projekt ODER den Entwurf aus dem Service!
  public localProjectDraft = computed(() => {
    const editProj = this.localEditProject();
    if (editProj) return editProj; // Wenn wir editieren, hat das Vorrang!

    return this.projectService.temporaryDraft(); // Ansonsten greifen wir auf das neue Backup zu
  });

  // 🕵️‍♂️ Ein computed Signal, damit dein HTML/CSS weiß, ob wir im Edit-Modus sind
  public isEditMode = computed(() => this.localEditProject() !== null);
  public isBrandNewDraft = signal<boolean>(false);
  
  public originalIdea = computed(() => {
    const currentProject = this.localProjectDraft();
    if (!currentProject || !currentProject.ideaId) return null;

    // Hier nutzen wir die Liste aus deinem NoteService (ich nehme an, sie heißt dort notesList oder ähnlich)
    // Passe den Namen an, falls deine Notizen-Liste im NoteService anders heißt!
    return this.noteService.notesList().find(note => note.id === currentProject.ideaId) || null;
  });

  // 📊 Das computed Signal für die Projekt-Auswahlliste (Option 5)
  public projects = computed(() => this.projectService.projectsList());

  public editingMilestoneId: string | null = null;
  public editTitle: string = '';
  public editTime: number | null = null;
  private allMilestonesAreShown: boolean = false
  private initialNavState = signal<'idea' | 'project' | null>(null);

  constructor() {
    /**
     * 🛰️ DER INTELLIGENTE NAVI-EFFEKT (Die Weichenstellung für dein Superteam)
     */
    effect(() => {
      const navState = this.tabService.currentNavigationState();
      console.log('📡 [Kalkulator] Neuer NavigationState empfangen:', navState);

      if (!navState) return;

      // 🔮 FALL 2 & FALL 4: Wir kommen vom Ideen-Board -> Idee kalkulieren!
      if (navState.type === 'idea') {
        console.log('💡 [Kalkulator] Verzweigung IDEA gewählt!');

        this.initialNavState.set('idea');
        this.isBrandNewDraft.set(true);   // Markieren als neuen Entwurf
        this.localEditProject.set(null);  // Edit-Modus ausschalten
        this.showRestoreBanner.set(false)
        const passendeIdee = this.noteService.notesList().find((n) => n.id === navState.id);
        if (passendeIdee && passendeIdee.id) {
          // Das Schutzschild im Service übernimmt! (Fall 2 löscht Altdaten, Fall 4 stellt wieder her)
          this.projectService.initializeOrRestoreDraft(passendeIdee.id, passendeIdee.title);
        }

        // State konsumieren
        this.tabService.currentNavigationState.set(null);
      }

      // ✏️ FALL 3: Wir kommen von der Projektseite -> Bestehendes Projekt editieren!
      else if (navState.type === 'project') {
        console.log('📁 [Kalkulator] Verzweigung PROJECT gewählt!');
        this.initialNavState.set('project')
        this.isBrandNewDraft.set(false); // Es ist kein neuer Draft mehr
        this.showRestoreBanner.set(false) 
        // Sicherheit geht vor: Entwurf im Service-RAM schlafen legen für die Zeit des Editierens
        this.projectService.updateTemporaryDraft(null);

        const passendesProjekt = this.projectService.projectsList().find((p) => p.id === navState.id);
        if (passendesProjekt) {
          // Tiefes Klonen in unser isoliertes Komponentensignal
          const geklontesProjekt = new Project({
            ...passendesProjekt,
            milestones: [...passendesProjekt.milestones],
          });
          this.localEditProject.set(geklontesProjekt);
        }

        // State konsumieren
        this.tabService.currentNavigationState.set(null);
      }
    });
  }

  public draftTitleFromStorage = signal<string | null>(null);

  ngOnInit(): void {
    // 🕵️‍♂️ Saubere Abfrage an den Service: Gibt es da was?
    this.projectService.updateTemporaryDraft(null);
    this.projectService.cleanSuggestions()
    this.localEditProject.set(null);

    const savedTitle = this.projectService.getSavedDraftTitle();
    console.log("OnInit:: savedTitle:", savedTitle)
    if (savedTitle) {
      // Wir merken uns nur den Titel für das Banner und schalten es an
      this.draftTitleFromStorage.set(savedTitle);
      this.showRestoreBanner.set(true);
    }
  }

  /**
   * 🎯 FALL 1a: Nutzer klickt „Ja, Entwurf weiterbearbeiten“
   */
  public restoreDraftFromBanner(): void {
    // 🔌 Jetzt sagen wir dem Service: Bitte ins RAM laden!
    this.projectService.restoreDraftFromStorage();
    this.isBrandNewDraft.set(true);     // Erstell-Modus aktivieren
    this.localEditProject.set(null);    // Editier-Modus aus
    this.showRestoreBanner.set(false);  // Banner weg
    console.log('🚑 [Kalkulator] Entwurf erfolgreich aus Banner wiederbelebt:', this.localProjectDraft());

  }

  /**
   * 🗑️ Nutzer klickt „Nein, löschen“
   */
  public rejectDraftFromBanner(): void {
    console.log('🙈 Entwurf wird ignoriert und bleibt im LocalStorage erhalten.');

    // Wir blenden das Banner einfach nur aus und tun sonst NICHTS!
    this.showRestoreBanner.set(false);
  }

  public totalTime = computed(() => {
    return this.localProjectDraft()?.getTotalDuration() ?? 0
  })

  /**
   * 🎯 FALL 1b / OPTION 5: Ein bestehendes Projekt manuell aus der Liste auswählen
   */
  public onProjectSelectedFromWelcome(projectId: string): void {
    if (!projectId) return;

    // Wir schalten den Erstell-Modus aus, da wir ein echtes DB-Projekt wählen!
    this.isBrandNewDraft.set(false);
    const project = this.projectService.projectsList().find(p => p.id === projectId) 
    if (!project) {
      return
    }
    // Tiefes Klonen über den Konstruktor in unser isoliertes Komponentensignal
    const selectedProject = new Project({
      ...project,
      milestones: [...project.milestones]
    });

    this.localEditProject.set(selectedProject);

    console.log("📊 [Kalkulator] Manuelle Projektauswahl erfolgreich:", selectedProject);
  }

  /**
   * 🔨 AUFGABE HINZUFÜGEN
   */
  public addTask(): void {
    const currentDraft = this.localProjectDraft();
    if (!currentDraft || !this.taskTitle.trim() || this.taskTime === null || this.taskTime <= 0) {
      return;
    }

    const neueAufgabe = new Milestone({
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      title: this.taskTitle.trim(),
      duration: this.taskTime,
    });

    const aktualisierteMilestones = [...currentDraft.milestones, neueAufgabe];

    this.updateDraftSignal(
      new Project({
        ...currentDraft,
        milestones: aktualisierteMilestones,
      })
    );

    this.taskTitle = '';
    this.taskTime = null;
    console.log('🔨 Aufgabe reingehämmert! Neuer Meilenstein-Stand:', aktualisierteMilestones);
  }

  /**
 * 🛠️ Interne Hilfsmethode, um den Entwurf im jeweils richtigen Signal zu aktualisieren
 */
  private updateDraftSignal(updatedProject: Project): void {
    console.log("updateDraftSignal: isEditMode =", this.isEditMode)
    if (this.isEditMode()) {
      this.localEditProject.set(updatedProject);
    } else {
      console.log("updateDraftSignal: call updateTemporaryDraft")
      this.projectService.updateTemporaryDraft(updatedProject);
    }
  }

  /**
   * 🗑️ AUFGABE LÖSCHEN
   */
  public deleteTask(taskId: string): void {
    const currentDraft = this.localProjectDraft();
    if (!currentDraft) return;

    const gefilterteMilestones = currentDraft.milestones.filter((m) => m.id !== taskId);

    this.updateDraftSignal(
      new Project({
        ...currentDraft,
        milestones: gefilterteMilestones,
      })
    );
    console.log(`🗑️ Aufgabe ${taskId} gelöscht.`);
  }

  /**
   * KALKULATION ABSCHLIESSEN (Startet das Popup und berechnet Tage)
   */
  public finishCalculation(): void {
    console.log("finishCalculation startet")

    const currentDraft = this.localProjectDraft();
    if (!currentDraft) return;
    console.log("finishCalculation nach dem prüfunh currentDraft")

    let totalDays = 0;
    const calculatedMilestones: Milestone[] = [];

    // Phasen-Zeiten zusammenrechnen
    for (const milestone of currentDraft.milestones) {
      totalDays += milestone.duration;
      calculatedMilestones.push(
        new Milestone({
          id: milestone.id,
          title: milestone.title,
          duration: milestone.duration,
        })
      );
    }
    console.log("finishCalculation nach dem schleife")

    // DIREKT IN DIE KLASSENVARIABLE SPEICHERN (Inklusive ID-Mitnahme!)
    this.projectToSend = new Project({
      id: currentDraft.id, // Wichtig: Existierende IDs reisen hier mit!
      title: currentDraft.title,
      area: currentDraft.area,
      ideaId: currentDraft.ideaId,
      milestones: calculatedMilestones,
    });

    this.finalProjectTitle.set(this.projectToSend.title);
    this.finalDays.set(totalDays);
    this.showSuccessPopup.set(true); // Popup wird sichtbar, Countdown startet
    console.log('⏳ Kalkulation vorbereitet. Koffer steht bereit für den Speicher-Countdown...', this.projectToSend);
  }

  /**
   * 💾 AUTOMATISCHES CONFIRM NACH POPUP-COUNTDOWN
   */
  public handleAutoSaveConfirm(): void {
    if (!this.projectToSend) return;
    console.log('✅ [Backend] Projektspeicherung:', this.projectToSend);
    console.log('✅ [Backend] Projekt is neu:', this.isBrandNewDraft);

    // 🕵️‍♂️ DIE UNZERSTÖRBARE ID-WEICHE:
    if (!this.isBrandNewDraft()) {
      console.log('✅ [Backend] Projekt aktualisieren:');

      // 🔄 PFAD A: Das Projekt hat eine ID -> Existierendes Projekt AKTUALISIEREN
      this.projectService.updateCalculatedProject(this.projectToSend).subscribe({
        next: (updatedProject) => {
          console.log('✅ [Backend] Projekt erfolgreich aktualisiert:', updatedProject?.title);

          this.projectToSend = null;

          this.projectService.clearTemporaryDraft();
          this.localEditProject.set(null);
          this.showSuccessPopup.set(false);

          this.tabService.changeTab(BoardTab.Projects, { type: 'project', id: updatedProject?.id ?? "" });
        },
        error: (err) => {
          console.error(' Fehler beim Projekt-Update:', err);
          this.showSuccessPopup.set(false);
        }
      });

    } else {
      console.log(' [Backend] Projekt erzeugen:');

      // 🆕 PFAD B: Das Projekt hat KEINE ID -> Brandneues Projekt ERSTELLEN
      this.projectService.saveCalculatedProject(this.projectToSend).subscribe({
        next: (projectId) => {
          console.log('🚀 [Backend] Neues Projekt erfolgreich erstellt! ID:', projectId);
          console.log("projekt ist gespeichert: allMilestonesAreShown = ", this.allMilestonesAreShown)
          if ( this.projectToSend ) { 
            this.projectService.ignoreSuggestions(this.projectToSend.title, this.allMilestonesAreShown)
          }
          this.projectToSend = null;
          this.projectService.cleanSuggestions()
          this.projectService.clearTemporaryDraft();
          this.localEditProject.set(null);
          this.showSuccessPopup.set(false);

          this.tabService.changeTab(BoardTab.Projects, { type: 'project', id: projectId });
        },
        error: (err) => {
          console.error(' Fehler beim Erstellen des Projekts:', err);
          this.showSuccessPopup.set(false);
        }
      });

    }
  }

  public degradedAreShown(shown: boolean) {
    this.allMilestonesAreShown = shown
  }

  /**
   *  NOTBREMSE IM POPUP
   */
  public cancelPopupCountdown(): void {
    this.projectToSend = null;
    this.showSuccessPopup.set(false);
    console.log(' Countdown abgebrochen, Speicher-Vorgang gestoppt.');
  }

  /**
   * ABBRECHEN-BUTTON UNTEN IN DER TABELLE
   */
  public abortCalculation(): void {
    console.log("ProjectCalculator:: abortClculation")
//    const navState = this.tabService.currentNavigationState();
    const currentDraft = this.localProjectDraft();

    console.log("ProjectCalculator:: abortClculation isBrandNewDraft = ", this.isBrandNewDraft())
    console.log("ProjectCalculator:: abortClculation currentIdea = ", this.currentIdea())
    if (this.isBrandNewDraft() && this.currentIdea()?.id) {
        this.noteService.updateNoteStatus(this.currentIdea()!.id!, false );
    }

    console.log('🗑️ Kalkulation abgebrochen. Lokaler RAM-Entwurf verworfen.');

    this.projectService.clearTemporaryDraft();
    this.localEditProject.set(null);
    this.projectService.cleanSuggestions()

    if (!this.isBrandNewDraft) return;

    if (this.initialNavState() === 'idea') {
      this.tabService.changeTab(BoardTab.Pinboard);
    } else if (this.initialNavState() === 'project') {
      this.tabService.changeTab(BoardTab.Projects);
    }
  }

  /**
    * ✏️ Aktiviert den Bearbeitungsmodus für eine Zeile
    */
  public startEditMilestone(milestone: Milestone): void {
    this.editingMilestoneId = milestone.id;
    this.editTitle = milestone.title;
    this.editTime = milestone.duration;
  }

  /**
   * ❌ Bricht das Bearbeiten ab
   */
  public cancelEditMilestone(): void {
    this.editingMilestoneId = null;
    this.editTitle = '';
    this.editTime = null;
  }

  /**
   * 💾 Speichert die geänderten Werte direkt im lokalen Draft-Signal
   */
  public saveEditMilestone(milestoneId: string): void {
    if (!this.editTitle.trim() || !this.editTime) return;

    const currentDraft = this.localProjectDraft();
    if (!currentDraft) return;

    // Werte im Array austauschen
    const updatedMilestones = currentDraft.milestones.map(m =>
      m.id === milestoneId
        ? new Milestone({ ...m, title: this.editTitle.trim(), duration: Number(this.editTime) })
        : m
    );

    // Signal updaten
    this.updateDraftSignal(new Project({
      ...currentDraft,
      milestones: updatedMilestones
    }));

    // Modus zurücksetzen
    this.cancelEditMilestone();
  }

  /**
   * 🎛️ Wird aufgerufen, wenn ein Meilenstein per Drag & Drop verschoben wurde
   */
  public onDrop(event: CdkDragDrop<Milestone[]>): void {
    const currentDraft = this.localProjectDraft();
    if (!currentDraft) return;

    // 1. Wir kopieren das Meilenstein-Array
    const updatedMilestones = [...currentDraft.milestones];

    // 2. Das Angular CDK sortiert das Array für uns um
    moveItemInArray(updatedMilestones, event.previousIndex, event.currentIndex);

    // 3. Wir vergeben die orderIndex-Zahlen lückenlos neu von 0 bis X
    const reIndexedMilestones = updatedMilestones.map((milestone, index) => {
      return new Milestone({
        ...milestone,
        orderIndex: index
      });
    });

    // 4. Signal mit den neu sortierten Daten aktualisieren
    currentDraft.milestones = reIndexedMilestones;
    this.updateDraftSignal(currentDraft);
  }

  // 🤖 Hilfsmethode: Liest den Titel und errät die beste Kategorie
  public getSuggestedArea(): 'Frontend' | 'Backend' | 'Design' | 'Allgemein' {
    const currentProject = this.localProjectDraft();
    if (!currentProject) return 'Allgemein';

    const titleLower = (currentProject.title || '').toLowerCase();

    // Die KI-Logik sucht nach Hinweisen im Projekttitel
    if (
      titleLower.includes('angular') || titleLower.includes('react') ||
      titleLower.includes('vue') || titleLower.includes('frontend') ||
      titleLower.includes('ui') || titleLower.includes('webseite') ||
      titleLower.includes('html') || titleLower.includes('css')
    ) {
      return 'Frontend';
    }

    if (
      titleLower.includes('kotlin') || titleLower.includes('spring') ||
      titleLower.includes('backend') || titleLower.includes('datenbank') ||
      titleLower.includes('api') || titleLower.includes('java') || titleLower.includes('sql')
    ) {
      return 'Backend';
    }

    if (
      titleLower.includes('figma') || titleLower.includes('design') ||
      titleLower.includes('ux') || titleLower.includes('ui/ux') ||
      titleLower.includes('logo') || titleLower.includes('sketch')
    ) {
      return 'Design';
    }

    // Fallback, wenn das Projekt "Rasen mähen" oder "Kuchen backen" heißt
    return 'Allgemein';
  }

  public suggestedArea = computed(() => {
    // Hier kommt deine originale Logik aus getSuggestedArea() rein!
    // Beispiel:
    return this.currentIdea()?.tag || 'Allgemein';
  });

  public canSaveCalculation = computed(() => {
    console.log("check if can save calculation")
    if (!this.isEditMode()) {
      console.log("not edit mode return true")
      return true
    }
    if (!this.localProjectDraft()) {
      console.log("no project in localProjectDraft return false")
       return false
    }
    const hasPermission = this.teamService.hasPermission(this.localProjectDraft()!.id, 'PROJECT_EDIT');
    console.log("check permission return ", hasPermission)
    return hasPermission
  })

public applySmartTemplates(): void {
  console.log("🔘 [UI] 1. Klick auf applySmartTemplates() registriert!");
  const currentProject = this.localProjectDraft();
  
  if (!currentProject) {
    console.warn("🛑 [UI] Abbruch: localProjectDraft ist null!");
    return;
  }
  if (!currentProject.title) {
    console.warn("🛑 [UI] Abbruch: Projekttitel ist leer!");
    return;
  }

  console.log(`🔘 [UI] 2. Starte Spinner und rufe Service auf für: "${currentProject.title}"`);
  this.isMagicLoading.set(true);

//  this.projectService.loadMilestoneSuggestions(currentProject.title, currentProject.area);

  setTimeout(() => {
    this.isMagicLoading.set(false);
  }, 1200);
}

  public currentIdea = computed(() => {
    const currentProject = this.localProjectDraft();
    if (!currentProject || !currentProject.ideaId) return null;

    // Wir durchsuchen das notes-Signal deines NoteServices nach der passenden ID
    // (Falls dein NoteService anders aufgebaut ist, z.B. als Funktion notes(), passe es kurz an)
    const allNotes = this.noteService.notesList();
    return allNotes.find(note => note.id === currentProject.ideaId) || null;
  });

  public toggleSidebar(): void {
    this.isSidebarOpen.update(prev => !prev);
  }

  /**
   * 📉 VORSCHLAG ABLEHNEN (Wegklicken via "×")
   */
  public degradeAiSuggestion(event: Event, suggestionTitle: string): void {
    // Verhindert, dass der Klick das übergeordnete "Hinzufügen"-Event auslöst
    event.stopPropagation();
    
    const currentDraft = this.projectService.temporaryDraft();
    const title = currentDraft ? currentDraft.title : '';

    // Dem Backend melden: Ab auf die Strafbank! (isDegraded = true)
    this.projectService.degradeSuggestion(title, suggestionTitle);
  }

  /**
   * ➕ FÜGT EINEN EINZELNEN VORSCHLAG ALS MEILENSTEIN HINZU
   */
  public addAiMilestone(milestoneTitle: string): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject) return;

    // 1. Aktuelle Liste kopieren oder leeres Array vorbereiten
    const currentMilestones = currentProject.milestones ? [...currentProject.milestones] : [];

    // 2. Prüfen, ob der Meilenstein nicht schon existiert, um Duplikate zu vermeiden
    const loweredTitle = milestoneTitle.trim().toLowerCase();
    if (currentMilestones.some(ms => ms.title.toLowerCase().trim() === loweredTitle)) {
      console.log('Meilenstein existiert bereits im Entwurf.');
      return;
    }

    // 3. Den nächsten freien Sortier-Index ermitteln
    let nextIndex = 0;
    if (currentMilestones.length > 0) {
      nextIndex = Math.max(...currentMilestones.map(m => m.orderIndex || 0)) + 1;
    }

    // 4. Den neuen Meilenstein-Baustein erstellen (Standardmäßig mit 1 Tag Dauer)
    const newMilestone = new Milestone({
      title: milestoneTitle,
      duration: 1, // Standardwert, den der User in der Tabelle anpassen kann
      usedDuration: 0,
      status: 'Offen',
      orderIndex: nextIndex,
      // @ts-ignore
      isNew: true
    });

    // 5. In die Liste pushen und das Projektsignal updaten
    currentMilestones.push(newMilestone);
    currentProject.milestones = currentMilestones;

    this.updateDraftSignal(new Project(currentProject));

    // 6. Dem DataManager über den Service Bescheid geben, damit die KI lernt!
    this.projectService.acceptSuggestion(currentProject.title, milestoneTitle);
  }
} 
