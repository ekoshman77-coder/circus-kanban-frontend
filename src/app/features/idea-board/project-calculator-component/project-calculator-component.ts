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
  private notificationService = inject(NotificationService);
  private teamService = inject(TeamService);

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

  // Labormodus für existierende Datenbank-Projekte
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

  protected originTab = signal<BoardTab | null>(null);

  // 🌟 DIE EINZIGE LESE-BRILLE FÜR DAS HTML
  public activeProject = computed<Project | null>(() => {
    return this.isBrandNewDraft() ? this.projectDraftService.currentDraft() : this.localEditProject();
  });

  // Calculation anhand der Lese-Brille
  public finalDays = computed(() => {
    const proj = this.activeProject();
    if (!proj || !proj.milestones) return 0;
    return proj.milestones.reduce((sum, ms) => sum + (+ms.duration || 0), 0);
  });

  /**
   * 🎯 DIE REAKTIVE WEICHE FÜR ÄNDERUNGEN
   * Gibt uns direkt das beschreibbare Signal zurück, das gerade aktiv ist!
   */
  private getActiveSignal() {
    return this.isBrandNewDraft() ? this.projectDraftService.currentDraft : this.localEditProject;
  }

  constructor() {
    console.log('🏗️ [Kalkulator] Constructor geladen.');

    effect(() => {
      const navState = this.navigationService.currentNavigationState();
      const userId = this.userService.getCurrentUserId();

      if (!userId || navState === null) return;

      console.log('🎯 [Effect] Eine definierte Aktion wurde im System erkannt:', navState);

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
    console.log('⛺ [ngOnInit] Kalkulator betreten. Projekte werden geladen...');
    this.projectService.loadProjects();
  }

  private handleNavigationStateChange(navState: NavigationState, userId: string): void {
    if (navState.type === 'tab-click') {
      console.log('⛺ [Way 3] Pure tab click detected safely via state. Checking storage...');
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
          console.log('♻️ [Way 1] Titles match! Restoring existing draft from storage...');
          this.projectDraftService.loadDraftFromStorageIntoSignal();
        } else {
          console.log('🧹 [Way 1] Old mismatching draft found. Overwriting with new idea draft!');
          this.projectDraftService.initDraftFromIdea(foundIdea);
        }
        this.suggestedArea.set(foundIdea.tag || 'Allgemein');
      }
    }
    else if (navState.type === 'project') {
      console.log('🧪 [Way 2] Active project loaded.');
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

    console.log('🧹 NavigationState wird bereinigt...');
    this.navigationService.currentNavigationState.set(null);
  }

  // ==========================================================================
  // AB HIER: DIE ABSTREAKTEN, WEICHENLOSEN MUTATIONS-METHODEN 🔥
  // ==========================================================================

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

    // Direkt in das aktive Signal schreiben!
    targetSignal.set(new Project({
      ...currentProject,
      milestones: [...currentMilestones, newMilestone]
    }));

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

    // Aktualisiert Titel UND Dauer gleichzeitig in einem Rutsch im aktiven Signal!
    targetSignal.set(new Project({
      ...currentProject,
      milestones: updatedMilestones
    }));

    this.editingMilestoneId = null;
    this.editTitle = '';
    console.log(`📝 [InlineEdit] Meilenstein an Index ${index} erfolgreich aktualisiert.`);
  }

  // Fallbacks
  public removeMilestone(index: number): void { this.onMilestoneRemoved(index); }
  public onDrop(event: any): void { this.onMilestoneDropped(event); }

  public restoreDraftFromBanner(): void {
    this.isBrandNewDraft.set(true);
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

  public cancelAndDiscardDraft(): void {
    console.log('❌ [Kalkulator] Aktion abgebrochen. Räume Speicher auf...');

    if (this.isBrandNewDraft()) {
      // 🗑️ Fall 1: Es war ein ungespeicherter Entwurf -> RAM leeren + Festplatte putzen!
      this.projectDraftService.clearDraft();
      this.currentIdea.set(null);
    } else {
      // 🛡️ Fall 2: Es war ein existierendes Projekt -> Nur Labor-RAM leeren, Draft im Service bleibt unberührt!
      this.localEditProject.set(null);
      console.log('🛡️ [Kalkulator] Existierendes Projekt geschlossen. Gespeicherter Entwurf bleibt im Hintergrund intakt.');
    }

    // Zurücksetzen auf Standard-State für den nächsten Besuch
    this.isBrandNewDraft.set(true);

    // User sanft dorthin zurückschicken, wo er herkam
    if (this.originTab() === BoardTab.Pinboard) {
      this.navigationService.changeTab(BoardTab.Pinboard, { type: 'idea', id: "" });
    } else {
      this.navigationService.changeTab(BoardTab.Projects, { type: 'project', id: "" });
    }
    this.originTab.set(null);
  }
  
  public abortCalculation(): void { this.cancelAndDiscardDraft(); }

  public finishCalculation(): void {
    const project = this.activeProject();
    if (!project) return;
    this.finalProjectTitle.set(project.title);
    this.showSuccessPopup.set(true);
  }

  public canSaveCalculation(): boolean {
    const project = this.activeProject();
    if (!project || !project.milestones || project.milestones.length === 0) return false;
    if (!this.isBrandNewDraft()) {
      return this.teamService.hasPermission(project.id, 'PROJECT_EDIT');
    }
    return true;
  }

  public applySmartTemplates(): void {
    const proj = this.activeProject();
    if (!proj || !proj.title) return;
    this.isMagicLoading.set(true);
    this.projectService.loadMilestoneSuggestions(proj.title, this.suggestedArea());
    setTimeout(() => this.isMagicLoading.set(false), 800);
  }

  public degradedAreShown(event: any): void {
    console.log('Sichtbarkeit geändert:', event);
  }

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
      next: (response: Project) => {
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

  public cancelPopupCountdown(): void {
    this.showSuccessPopup.set(false);
  }

  // ==========================================================================
  // INLINE EDIT UI METHODS (ZURÜCKGEHOLT) ✏️
  // ==========================================================================

  /**
   * Startet den Inline-Edit-Modus für eine bestimmte Meilenstein-Zeile
   */
  public startEditMilestone(task: Milestone): void {
    this.editingMilestoneId = task.id;
    this.editTitle = task.title;
    this.editTime = task.duration || 1;
    console.log(`✏️ [Kalkulator] Inline-Edit gestartet für: "${task.title}"`);
  }

  /**
   * Bricht das Inline-Editing ab und setzt die Formularfelder zurück
   */
  public cancelEditMilestone(): void {
    this.editingMilestoneId = null;
    this.editTitle = '';
    this.editTime = 1;
    console.log('❌ [Kalkulator] Inline-Edit abgebrochen.');
  }
}