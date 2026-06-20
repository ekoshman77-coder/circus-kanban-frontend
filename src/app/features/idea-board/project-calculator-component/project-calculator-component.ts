import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../core/services/project-service';
import { NoteService } from '../../../core/services/note-service';
import { Project } from '../../../core/models/project';
import { Milestone } from '../../../core/models/milestone';
import { NavigationState, TabNavigationService } from '../tab-navigation-service';
import { BoardTab } from '../tab-navigation-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { TodoService } from '../../../core/services/todo/todo-service';

@Component({
  selector: 'app-project-calculator-component',
  standalone: true,
  imports: [CommonModule, FormsModule, UniversalPopupComponent],
  templateUrl: './project-calculator-component.html',
  styleUrl: './project-calculator-component.css',
})
export class ProjectCalculatorComponent {
  public projectService = inject(ProjectService);
  public noteService = inject(NoteService);
  private tabService = inject(TabNavigationService);

  // Reaktive Zustände für das Erfolgs-Popup
  public showSuccessPopup = signal(false);
  public finalProjectTitle = signal('');
  public finalDays = signal(0);

  // Formular-Zustände für neue Aufgaben
  public taskTitle: string = '';
  public taskTime: number | null = null;
  private readonly MAX_DURATION_DAYS = 10;
  public minTaskTime: number = 1; // 🎯 Startet standardmäßig mit 1 Tag!
  
  public availableDays: number[] = Array.from({ length: this.MAX_DURATION_DAYS }, (_, i) => i + 1);
  private projectToSend: Project | null = null;

  // 1️⃣ Das reaktive Signal für den lokalen Arbeits-Entwurf (wird im Template editiert)
  public localProjectDraft = signal<Project | null>(null);

  // 📊 Das computed Signal für die Projekt-Auswahlliste (Option 5)
  public projects = computed(() => this.projectService.projectsList());

  public editingMilestoneId: string | null = null;
  public editTitle: string = '';
  public editTime: number | null = null;

  constructor() {
    /**
     * 🛰️ DER NAVI-EFEKT (Der automatische Daten-Empfänger)
     */
    effect(() => {
      const navState = this.tabService.currentNavigationState();
      console.log('📡 [Kalkulator] Neuer NavigationState empfangen:', navState);

      if (!navState) {
        return;
      }
      console.log('🕵️‍♂️ [Kalkulator-DEBUG] Welcher State kommt an?', navState);
      if (navState.type === 'idea') {
        console.log('💡 [Kalkulator-DEBUG] Verzweigung IDEA gewählt!');
        const passendeIdee = this.noteService.notesList().find((n) => n.id === navState.id);
        if (passendeIdee) {
          const neuerProjektEntwurf = new Project({
            title: passendeIdee.title,
            area: passendeIdee?.content?? "",
            ideaId: passendeIdee?.id?? "",
            milestones: [],
          });
          this.localProjectDraft.set(neuerProjektEntwurf);
          this.isBrandNewDraft.set(true);
          console.log('🎲 [Kalkulator] Entwurf aus Idee im RAM erstellt:', neuerProjektEntwurf);
          this.tabService.currentNavigationState.set(null)
        }
      } else if (navState.type === 'project') {
        console.log('📁 [Kalkulator-DEBUG] Verzweigung PROJECT gewählt!');
        const passendesProjekt = this.projectService.projectsList().find((p) => p.id === navState.id);
        console.log('📁 [Kalkulator-DEBUG] In projectsList() gesucht nach ID:', navState.id);
        console.log('📁 [Kalkulator-DEBUG] Alle verfügbaren Projekte im Service:', this.projectService.projectsList());
        if (passendesProjekt) {
          console.log('📁 [Kalkulator-DEBUG] BESTEHENDES PROJEKT ERFOLGREICH GEFUNDEN:', passendesProjekt.title);
          const geklontesProjekt = new Project({
            ...passendesProjekt,
            milestones: [...passendesProjekt.milestones],
          });
          this.localProjectDraft.set(geklontesProjekt);
          console.log('📁 [Kalkulator] Bestehendes Projekt geladen & geklont:', geklontesProjekt);
        }
      }
    });
  }

  public totalTime = computed(() =>{
    return this.localProjectDraft()?.getTotalDuration()?? 0
  })

  public isBrandNewDraft = signal<boolean>(false);

  /**
   * 🎛️ OPTION 5: Ein bestehendes Projekt manuell aus der Liste auswählen
   */
  public selectExistingProject(project: Project): void {
    if (!project) return;

    // Tiefes Klonen über den Konstruktor, damit wir das Original im RAM nicht zerstören
    const selectedProject = new Project({
      ...project,
      milestones: [...project.milestones]
    });
    
    this.localProjectDraft.set(selectedProject);
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

    this.localProjectDraft.set(
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
   * 🗑️ AUFGABE LÖSCHEN
   */
  public deleteTask(taskId: string): void {
    const currentDraft = this.localProjectDraft();
    if (!currentDraft) return;

    const gefilterteMilestones = currentDraft.milestones.filter((m) => m.id !== taskId);

    this.localProjectDraft.set(
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
          this.localProjectDraft.set(null);
          this.showSuccessPopup.set(false);
          
          this.tabService.changeTab(BoardTab.Projects, { type: 'project', id: updatedProject?.id?? "" });
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
          this.localProjectDraft.set(null);
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
    this.localProjectDraft.set(null);
    
    if (!navState) return;

    if (navState.type === 'idea') {
      this.tabService.changeTab(BoardTab.IdeaBoard);
    } else if (navState.type === 'project') {
      this.tabService.changeTab(BoardTab.Projects, { type: 'project', id: navState.id });
    }
  }

  /**
 * Sauberes Aufräumen nach dem Speichern 🧹
 */
 private cleanupAfterSave(targetId: string): void {
  this.projectToSend = null;
  this.localProjectDraft.set(null);
  this.showSuccessPopup.set(false);
  
  // Wichtig: Wir setzen das Signal hier nach dem erfolgreichen Speichern wieder zurück,
  // damit der Kalkulator für die nächste Berechnung wieder "jungfräulich" auf false steht!
  this.isBrandNewDraft.set(false); 
  
  this.tabService.changeTab(BoardTab.Projects, { type: 'project', id: targetId });
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
    this.localProjectDraft.set(new Project({
      ...currentDraft,
      milestones: updatedMilestones
    }));

    // Modus zurücksetzen
    this.cancelEditMilestone();
  }
}