import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../core/services/project-service';
import { NoteService } from '../../../core/services/note-service';
import { Project } from '../../../core/models/project';
import { Milestone } from '../../../core/models/milestone';
import { BoardTab, NavigationState, TabNavigationService } from '../tab-navigation-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MilestoneSuggestionsComponent } from '../milestone-suggestions-component/milestone-suggestions-component';
import { UserService } from '../../../core/services/user/user-service';
import { ProjectDraftService } from '../../../core/services/project-draft-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { Note } from '../../../core/models/note';
import { NotificationService } from '../../../core/services/notification-service';
import { HttpErrorResponse } from '@angular/common/http';
import { TeamService } from '../../../core/services/team-service';

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
  // Services
  protected projectService = inject(ProjectService);
  protected noteService = inject(NoteService);
  protected navigationService = inject(TabNavigationService);
  protected todoService = inject(TodoService);
  protected userService = inject(UserService);
  public projectDraftService = inject(ProjectDraftService);
  private notificationService = inject(NotificationService)
  private teamService = inject(TeamService)

  // States
  public currentIdea = signal<Note | null>(null);
  protected isBrandNewDraft = signal<boolean>(true);
  protected isSidebarOpen = signal<boolean>(false);

  // Banner
  protected showRestoreBanner = signal<boolean>(false);
  protected draftTitleFromStorage = signal<string>('');

  // Form
  protected newMilestoneTitle = signal<string>('');
  protected newMilestoneDuration = signal<number>(1);

  // Labormodus
  protected localEditProject = signal<Project | null>(null);

  // AI-Templates
  protected suggestedArea = signal<string>('Allgemein');
  protected isMagicLoading = signal<boolean>(false);

  // Popups
  protected showSuccessPopup = signal<boolean>(false);
  protected finalProjectTitle = signal<string>('');

  // Inline Edit
  protected editingMilestoneId: string | null = null;
  protected editTitle: string = '';
  protected editTime: number = 1;
  public availableDays: number[] = Array.from({ length: 30 }, (_, i) => i + 1);

  // 🗺️ 1. UNSER NEUES SICHERHEITS-SIGNAL FÜR DEN URSPRUNG
  protected originTab = signal<BoardTab | null>(null);

  // --- DIE MAGISCHE BRILLE ---
  public localProjectDraft = computed<Project | null>(() => {
    if (this.isBrandNewDraft()) {
      return this.projectDraftService.currentDraft();
    } else {
      return this.localEditProject();
    }
  });

  // 🌟 FIX FÜR DEIN HTML: Das HTML verlangt nach activeProject(), hier ist die Brücke!
  public activeProject = computed<Project | null>(() => this.localProjectDraft());

  // Calculation
  public finalDays = computed(() => {
    const proj = this.localProjectDraft();
    if (!proj || !proj.milestones) return 0;
    return proj.milestones.reduce((sum, ms) => sum + (+ms.duration || 0), 0);
  });

  constructor() {
    console.log('🏗️ [Kalkulator] Constructor geladen.');

    effect(() => {
      const navState = this.navigationService.currentNavigationState();
      const userId = this.userService.getCurrentUserId();

      if (!userId || navState === null) return;
      
      if (navState.type === 'idea') {
        this.originTab.set(BoardTab.Pinboard);
      } else if (navState.type === 'project') {
        this.originTab.set(BoardTab.Projects);
      }
      console.log('🎯 [Effect] Eine Aktion wurde auf der Pinnwand/Menü getriggert:', navState);
      this.handleNavigationStateChange(navState, userId);
    });
  }

  ngOnInit(): void {
    console.log('⛺ [ngOnInit] Kalkulator betreten.');
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.handleNavigationStateChange(null, userId);
    }
  }

  private handleNavigationStateChange(navState: NavigationState | null, userId: string): void {
    if (navState === null) {
      console.log('⛺ [Zustand 3] Normaler Tab-Klick. Prüfe Storage auf ungespeicherte Arbeit...');
      const hatEntwurf = this.projectDraftService.hasExistingDraftInStorage(userId);

      if (hatEntwurf && !this.localEditProject() && !this.projectDraftService.currentDraft()) {
        const cachedTitle = this.projectDraftService.getDraftTitleFromStorage(userId);
        this.draftTitleFromStorage.set(cachedTitle || 'Unbenanntes Projekt');
        this.showRestoreBanner.set(true);
      } else {
        this.showRestoreBanner.set(false);
      }
      return;
    }

    if (navState.type === 'idea') {
      this.isBrandNewDraft.set(true);
      this.localEditProject.set(null);

      const foundIdea = this.noteService.notesList().find((n) => n.id === navState.id);
      if (foundIdea) {
        this.currentIdea.set(foundIdea);
        const laufendesDraft = this.projectDraftService.currentDraft();
        if (laufendesDraft && (laufendesDraft as any).ideaId === foundIdea.id) {
          console.log('♻️ Exakt diese Idee liegt schon im Draft.');
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

      const passendesProjekt = this.projectService.projectsList().find((p) => p.id === navState.id);
      if (passendesProjekt) {
        this.localEditProject.set(new Project({
          ...passendesProjekt,
          milestones: [...(passendesProjekt.milestones || [])]
        }));
        this.suggestedArea.set(passendesProjekt.area || 'Allgemein');
      }
    }

    this.navigationService.currentNavigationState.set(null);
  }

  public onMilestoneAdded(milestoneTitle: string, customDuration?: number): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject) return;

    const trimmedTitle = milestoneTitle.trim();
    if (!trimmedTitle) return;

    const currentMilestones = currentProject.milestones ? [...currentProject.milestones] : [];
    const loweredTitle = trimmedTitle.toLowerCase();

    if (currentMilestones.some(ms => ms.title.toLowerCase().trim() === loweredTitle)) {
      return;
    }

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

    if (this.isBrandNewDraft()) {
      this.projectDraftService.addMilestoneToDraft(newMilestone, customDuration);
    } else {
      const updatedMilestones = [...currentMilestones, newMilestone];
      this.localEditProject.set(new Project({
        ...currentProject,
        milestones: updatedMilestones
      }));
    }

    this.projectService.acceptSuggestion(currentProject.title, trimmedTitle);
  }

  public addNewMilestoneFromForm(): void {
    const titel = this.newMilestoneTitle().trim();
    const tage = this.newMilestoneDuration();
    if (!titel) return;

    this.onMilestoneAdded(titel, tage);
    this.newMilestoneTitle.set('');
    this.newMilestoneDuration.set(1);
  }

  public onMilestoneRemoved(index: number): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject || !currentProject.milestones) return;

    const milestoneToDegrade = currentProject.milestones[index];
    if (!milestoneToDegrade) return;

    if (this.isBrandNewDraft()) {
      this.projectDraftService.removeMilestone(index);
    } else {
      const updatedMilestones = [...currentProject.milestones];
      updatedMilestones.splice(index, 1);
      this.localEditProject.set(new Project({
        ...currentProject,
        milestones: updatedMilestones
      }));
    }

    this.projectService.degradeSuggestion(currentProject.title, milestoneToDegrade.title);
  }

  public onMilestoneDropped(event: CdkDragDrop<Milestone[]>): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject || !currentProject.milestones) return;
    if (event.previousIndex === event.currentIndex) return;

    if (this.isBrandNewDraft()) {
      this.projectDraftService.reorderMilestones(event.previousIndex, event.currentIndex, moveItemInArray);
    } else {
      const updatedMilestones = [...currentProject.milestones];
      moveItemInArray(updatedMilestones, event.previousIndex, event.currentIndex);
      updatedMilestones.forEach((ms, idx) => ms.orderIndex = idx);
      this.localEditProject.set(new Project({
        ...currentProject,
        milestones: updatedMilestones
      }));
    }
  }

  public onMilestoneDurationChanged(index: number, newDuration: number): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject || !currentProject.milestones || !currentProject.milestones[index]) return;

    const finalDuration = newDuration > 0 ? newDuration : 1;

    if (this.isBrandNewDraft()) {
      this.projectDraftService.updateMilestoneInDraft(index, { duration: finalDuration });
    } else {
      const updatedMilestones = currentProject.milestones.map((ms, i) => {
        if (i === index) return new Milestone({ ...ms, duration: finalDuration });
        return ms;
      });
      this.localEditProject.set(new Project({
        ...currentProject,
        milestones: updatedMilestones
      }));
    }
  }

  public onMilestoneTitleChanged(index: number, newTitle: string): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject || !currentProject.milestones || !currentProject.milestones[index]) return;

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    if (this.isBrandNewDraft()) {
      this.projectDraftService.updateMilestoneInDraft(index, { title: trimmedTitle });
    } else {
      const updatedMilestones = currentProject.milestones.map((ms, i) => {
        if (i === index) return new Milestone({ ...ms, title: trimmedTitle });
        return ms;
      });
      this.localEditProject.set(new Project({
        ...currentProject,
        milestones: updatedMilestones
      }));
    }
  }

  // Fallback-Methoden für ältere HTML Bindings
  public removeMilestone(index: number): void { this.onMilestoneRemoved(index); }
  public onDrop(event: any): void { this.onMilestoneDropped(event); }

  public restoreDraftFromBanner(): void {
    this.projectDraftService.loadDraftFromStorageIntoSignal();
    const geladenerDraft = this.projectDraftService.currentDraft();
    if (geladenerDraft) {
      this.suggestedArea.set(geladenerDraft.area || 'Allgemein');
      if ((geladenerDraft as any).ideaId) {
        const passendeIdee = this.noteService.notesList().find(n => n.id === (geladenerDraft as any).ideaId);
        if (passendeIdee) this.currentIdea.set(passendeIdee);
      }
    }
    this.showRestoreBanner.set(false);
  }

  public rejectDraftFromBanner(): void {
    this.projectDraftService.clearDraft();
    this.showRestoreBanner.set(false);
  }

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

  public toggleSidebar(): void {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  public handleStartProjectCalculation(): void {
    const project = this.localProjectDraft();
    if (!project || !project.milestones || project.milestones.length === 0) return;

    this.projectService.saveCalculatedProject(project);

    if (this.isBrandNewDraft()) {
      this.projectDraftService.clearDraft();
    }
    console.log('🚀 Projekt erfolgreich kalkuliert!');
  }

  public startEditMilestone(task: Milestone): void {
    this.editingMilestoneId = task.id ?? null;
    this.editTitle = task.title;
    this.editTime = task.duration || 1;
  }

  public cancelEditMilestone(): void {
    this.editingMilestoneId = null;
    this.editTitle = '';
    this.editTime = 1;
  }

  public saveInlineEdit(index: number): void {
    const currentProject = this.localProjectDraft();
    if (!currentProject || !currentProject.milestones || !currentProject.milestones[index]) {
      this.editingMilestoneId = null;
      return;
    }

    const trimmedTitle = this.editTitle.trim();
    if (!trimmedTitle) {
      this.editingMilestoneId = null;
      return;
    }

    if (this.isBrandNewDraft()) {
      // Wenn es ein neuer Entwurf ist, über den DraftService aktualisieren
      this.projectDraftService.updateMilestoneInDraft(index, { 
        title: trimmedTitle 
      });
    } else {
      // Wenn es ein existierendes Projekt ist, das lokale Signal aktualisieren
      const updatedMilestones = currentProject.milestones.map((ms, i) => 
        i === index ? new Milestone({ ...ms, title: trimmedTitle }) : ms
      );
      this.localEditProject.set(new Project({ 
        ...currentProject, 
        milestones: updatedMilestones 
      }));
    }

    // Editier-Modus beenden
    this.editingMilestoneId = null;
    this.editTitle = '';
    console.log(`📝 [InlineEdit] Meilenstein an Index ${index} erfolgreich umbenannt zu: "${trimmedTitle}"`);
  }

public cancelAndDiscardDraft(): void {
  console.log('❌ Kalkulation abgebrochen. Räume Speicher auf...');
  
  // 1. Wir lesen den sicher gespeicherten Ursprung aus
 // const woherWirKamen = this.originTab();

  // 2. Lokale Signale und Caches sauber leeren[cite: 5, 7]
  this.localEditProject.set(null);
  this.projectDraftService.clearDraft();
  this.currentIdea.set(null);
  this.isBrandNewDraft.set(true);

  // 3. Dynamische und richtige Navigation je nach Ausgangslage
  if (this.originTab() === BoardTab.Pinboard) {
    // Wenn wir von einer Idee kamen, zurück zur Pinnwand
    this.navigationService.changeTab(BoardTab.Pinboard, { 
      type: 'idea', 
      id: "" 
    });
    console.log('✈️ [Navigation] Sicher zurück zur Pinnwand geleitet.');
  } else {
    // Andernfalls (oder als sicherer Fallback) zurück zur Projektübersicht
    this.navigationService.changeTab(BoardTab.Projects, { 
      type: 'project', 
      id: "" 
    });
    console.log('✈️ [Navigation] Sicher zurück zur Projektliste geleitet.');
  }

  // 4. Zum Schluss das Signal für die nächste Runde wieder resetten
  this.originTab.set(null);
}

  public abortCalculation(): void { this.cancelAndDiscardDraft(); }

  public finishCalculation(): void {
    const project = this.localProjectDraft();
    if (!project) return;
    this.finalProjectTitle.set(project.title);
    this.showSuccessPopup.set(true);
  }

  public canSaveCalculation(): boolean {
    const project = this.localProjectDraft();
    // Basis-Check: Es muss ein Projekt da sein und mindestens 1 Meilenstein existieren
    if (!project || !project.milestones || project.milestones.length === 0) return false;

    // Wenn es ein existierendes Projekt im Edit-Mode ist, prüfen wir den Besitzer
    if (!this.isBrandNewDraft()) {

      return this.teamService.hasPermission(project.id, 'PROJECT_EDIT'); // true = darf speichern, false = gesperrt
    }

    // Ein brandneues Projekt darf JEDER erzeugen
    return true;
  }

  public applySmartTemplates(): void {
    const proj = this.localProjectDraft();
    if (!proj || !proj.title) return;
    this.isMagicLoading.set(true);
    this.projectService.loadMilestoneSuggestions(proj.title, this.suggestedArea());
    setTimeout(() => this.isMagicLoading.set(false), 800);
  }

  public degradedAreShown(event: any): void {
    console.log('Sichtbarkeit geändert:', event);
  }

  // ==========================================
  // SCHRITT 2: Benutzer klickt im Popup auf "Ja, final speichern 💾"
  // ==========================================
  // ==========================================
  // SCHRITT 2: Benutzer klickt im Popup auf "Ja, final speichern 💾"
  // ==========================================
  public handleAutoSaveConfirm(): void {
    // 1. Validierung: Haben wir überhaupt Daten und Meilensteine?
    const project = this.localProjectDraft();
    if (!project || !project.milestones || project.milestones.length === 0) {
      this.notificationService.showNotification('Keine Daten oder Meilensteine zum Speichern vorhanden! 🛑', 'error');
      this.showSuccessPopup.set(false);
      return;
    }

    // 2. Rechte-Check NUR für existierende Projekte (Editier-Modus)
    if (!this.isBrandNewDraft()) {
      const currentUserId = this.userService.getCurrentUserId();
      if (project.userId !== currentUserId) {
        this.notificationService.showNotification('Du hast keine Berechtigung, dieses bestehende Projekt zu verändern! 🛑', 'error');
        this.showSuccessPopup.set(false);
        return;
      }
    }

    console.log('💾 [Popup Bestätigt] Starte Speichervorgang für:', project.title);

    // 3. Weiche stellen: Neues Projekt (create) oder Altes Projekt (update)?
    // Hinweis: Wenn deine Update-Methode im ProjectService anders heißt (z.B. updateExistingProject), passe den Namen hier kurz an!
    const saveObservable = this.isBrandNewDraft()
      ? this.projectService.saveCalculatedProject(project)
      : (this.projectService as any).updateProject?.(project) || this.projectService.saveCalculatedProject(project);

    // 4. HTTP-Anfrage über das Netzwerk jagen mittels .subscribe()
    saveObservable.subscribe({
      next: (response: Project) => {
        // Passenden Text für die Notification wählen
        const erfolgsNachricht = this.isBrandNewDraft()
          ? `Projekt "${project.title}" wurde erfolgreich gestartet! 🚀`
          : `Änderungen am Projekt "${project.title}" wurden erfolgreich gespeichert! 💾`;

        this.notificationService.showNotification(erfolgsNachricht, 'success');

        // 5. Lokalen Cache sauber aufräumen
        if (this.isBrandNewDraft()) {
          this.projectDraftService.clearDraft();
          this.currentIdea.set(null);
        } else {
          this.localEditProject.set(null);
        }

        // Zustand zurücksetzen & Popup schließen
        this.isBrandNewDraft.set(true);
        this.showSuccessPopup.set(false);

        // ✈️ 6. Automatische Weiterleitung zur Projektseite
        this.navigationService.changeTab(BoardTab.Projects, { type: 'project', id: "" });

        console.log('🏁 [Kalkulator] Speichern und Weiterleitung erfolgreich abgeschlossen.');
      },
      error: (err: HttpErrorResponse) => {
        // 🔴 err ist ein echtes Angular HttpErrorResponse-Objekt!
        console.error(`❌ HTTP-Fehler ${err.status}: ${err.message}`, err);

        // Wenn der Server eine Fehlermeldung im Body mitschickt, zeigen wir diese an, sonst Fallback
        const serverMessage = err.error?.message || 'Fehler beim Speichern auf dem Server!';

        this.notificationService.showNotification(serverMessage, 'error');
        this.showSuccessPopup.set(false);
      }
    });
  }

  public cancelPopupCountdown(): void {
    this.showSuccessPopup.set(false);
  }
}