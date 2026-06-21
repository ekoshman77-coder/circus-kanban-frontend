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

@Component({
  selector: 'app-project-calculator-component',
  standalone: true,
  imports: [CommonModule, FormsModule, UniversalPopupComponent, DragDropModule],
  templateUrl: './project-calculator-component.html',
  styleUrl: './project-calculator-component.css',
})
export class ProjectCalculatorComponent implements OnInit {
  public projectService = inject(ProjectService);
  public noteService = inject(NoteService);
  private tabService = inject(TabNavigationService);

  // Reaktive Zustände für das Erfolgs-Popup
  public showSuccessPopup = signal(false);
  public finalProjectTitle = signal('');
  public finalDays = signal(0);
  public isMagicLoading = signal<boolean>(false);

  // Formular-Zustände für neue Aufgaben
  public taskTitle: string = '';
  public taskTime: number | null = null;
  private readonly MAX_DURATION_DAYS = 10;
  public minTaskTime: number = 1; // 🎯 Startet standardmäßig mit 1 Tag!

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

        this.isBrandNewDraft.set(true);   // Markieren als neuen Entwurf
        this.localEditProject.set(null);  // Edit-Modus ausschalten

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

        this.isBrandNewDraft.set(false); // Es ist kein neuer Draft mehr

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
public selectExistingProject(project: Project): void {
  if (!project) return;

  // Wir schalten den Erstell-Modus aus, da wir ein echtes DB-Projekt wählen!
  this.isBrandNewDraft.set(false);

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
   * 🚀 KALKULATION ABSCHLIESSEN (Startet das Popup und berechnet Tage)
   */
  public finishCalculation(): void {
    const currentDraft = this.localProjectDraft();
    if (!currentDraft) return;

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

    // 💾 DIREKT IN DIE KLASSENVARIABLE SPEICHERN (Inklusive ID-Mitnahme!)
    this.projectToSend = new Project({
      id: currentDraft.id, // 🔥 Wichtig: Existierende IDs reisen hier mit!
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
          console.error('❌ Fehler beim Projekt-Update:', err);
          this.showSuccessPopup.set(false);
        }
      });

    } else {
      console.log('✅ [Backend] Projekt erzeugen:');

      // 🆕 PFAD B: Das Projekt hat KEINE ID -> Brandneues Projekt ERSTELLEN
      this.projectService.saveCalculatedProject(this.projectToSend).subscribe({
        next: (projectId) => {
          console.log('🚀 [Backend] Neues Projekt erfolgreich erstellt! ID:', projectId);

          this.projectToSend = null;

          this.projectService.clearTemporaryDraft();
          this.localEditProject.set(null);
          this.showSuccessPopup.set(false);

          this.tabService.changeTab(BoardTab.Projects, { type: 'project', id: projectId });
        },
        error: (err) => {
          console.error('❌ Fehler beim Erstellen des Projekts:', err);
          this.showSuccessPopup.set(false);
        }
      });

    }
  }

  /**
   * 🛑 NOTBREMSE IM POPUP
   */
  public cancelPopupCountdown(): void {
    this.projectToSend = null;
    this.showSuccessPopup.set(false);
    console.log('🛑 Countdown abgebrochen, Speicher-Vorgang gestoppt.');
  }

  /**
   * ❌ ABBRECHEN-BUTTON UNTEN IN DER TABELLE
   */
  public abortCalculation(): void {
    const navState = this.tabService.currentNavigationState();
    const currentDraft = this.localProjectDraft();

    if (navState?.type === 'idea' && currentDraft?.ideaId) {
      const passendeIdee = this.noteService.notesList().find(n => n.id === currentDraft.ideaId);
      if (passendeIdee) {
        this.noteService.updateNote({ ...passendeIdee, isInCalculation: false });
      }
    }

    console.log('🗑️ Kalkulation abgebrochen. Lokaler RAM-Entwurf verworfen.');

    this.projectService.clearTemporaryDraft();
    this.localEditProject.set(null);

    if (!navState) return;

    if (navState.type === 'idea') {
      this.tabService.changeTab(BoardTab.IdeaBoard);
    } else if (navState.type === 'project') {
      this.tabService.changeTab(BoardTab.Projects, { type: 'project', id: navState.id });
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
    // Ersetze am Ende von saveEditMilestone() das .set() durch:
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

  // 🪄 Die Hauptmethode für den Klick
  public applySmartTemplates(): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject || this.isMagicLoading()) return;

    // 1. Schalte den Lade-Modus AN
    this.isMagicLoading.set(true);

    // 2. Wir simulieren 800ms "KI-Bedenkzeit" für den Wow-Effekt!
    setTimeout(() => {
      const determinedArea = this.getSuggestedArea();
      const templates = MILESTONE_TEMPLATES[determinedArea];

      const currentMilestones = [...currentProject.milestones];
      let nextIndex = currentMilestones.length;

      templates.forEach(template => {
        const loweredTemplate = template.title.trim().toLowerCase()
        if (!currentMilestones.some(existingMs => existingMs.title.toLowerCase().trim() === loweredTemplate)) {
          const newMilestone = new Milestone({
            title: template.title,
            duration: template.duration,
            usedDuration: 0,
            status: 'Offen',
            orderIndex: nextIndex,
            // @ts-ignore (Falls das Feld im Modell nicht existiert, nutzen wir es einfach im Template)
            isNew: true
          })
          nextIndex = nextIndex + 1
          currentMilestones.push(newMilestone)
        }
      })

      currentProject.milestones = [...currentMilestones];
      currentProject.area = determinedArea;

      // Sauberes Signal-Update mit neuer Instanz
      this.updateDraftSignal(new Project(currentProject));
      // 3. Schalte den Lade-Modus wieder AUS
      this.isMagicLoading.set(false);
    }, 1800);
  }
}