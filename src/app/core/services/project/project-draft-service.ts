import { Injectable, signal, computed, inject } from '@angular/core';
import { Project } from '../../models/project';
import { Milestone } from '../../models/milestone';
import { UserService } from '../user/user-service';
import { ProjectService } from './project-service';
import { Note } from '../../models/note';

@Injectable({
    providedIn: 'root'
})
export class ProjectDraftService {
    private userService = inject(UserService);
    private projectService = inject(ProjectService);

    // 1. Das Signal für das eigentliche Projekt (Die Single Source of Truth)
    private draftSignal = signal<Project | null>(null);
    public readonly currentDraft = this.draftSignal.asReadonly();

    // 🧠 2. Das Signal für die abgelehnten KI-Vorschläge
    private degradedMilestonesSignal = signal<string[]>([]);
    public readonly degradedMilestones = this.degradedMilestonesSignal.asReadonly();

    constructor() {
        // 🧼 KEIN EFFECT MEHR! Der Service sitzt völlig ruhig da und wartet nur auf Anweisungen.
    }

    // ==========================================
    // 💾 EXPLICITE SPEICHER-BEFEHLE
    // ==========================================

    /**
     * Schreibt den aktuellen Zustand JETZT direkt physisch in den LocalStorage.
     * Wird von den Meilenstein-Methoden unten aufgerufen, wenn Änderungen diktiert werden.
     */
    public saveDraftToStorage(): void {
        const userId = this.userService.getCurrentUserId();
        const draft = this.draftSignal();
        const degraded = this.degradedMilestonesSignal();

        if (userId && draft) {
            const storageKey = 'local_project_draft_' + userId;
            const wrapperData = { project: draft, degradedMilestones: degraded };
            localStorage.setItem(storageKey, JSON.stringify(wrapperData));
            console.log(`💾 [DraftService] Entwurf manuell im Storage gesichert für User: ${userId}`);
        }
    }

    // ==========================================
    // 🌟 ENTWURF-INITIALISIERUNG & STRATEGIE
    // ==========================================

    /**
     * Holt den Entwurf aktiv aus dem Storage und setzt das Signal.
     * Der Service tut das NICHT von alleine, sondern nur wenn die Komponente danach fragt!
     */
    public loadDraftFromStorageIntoSignal(): void {
        const userId = this.userService.getCurrentUserId();
        if (!userId) return;

        const storageKey = 'local_project_draft_' + userId;
        const raw = localStorage.getItem(storageKey);
        
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed?.project) {
                    this.draftSignal.set(new Project(parsed.project));
                    this.degradedMilestonesSignal.set(parsed.degradedMilestones || []);
                    console.log(`📥 [DraftService] Entwurf erfolgreich aus Storage geladen.`);
                }
            } catch (e) {
                console.error('[DraftService] Fehler beim Laden des Entwurfs:', e);
            }
        }
    }

    /**
     * Startet einen komplett neuen Entwurf im Signal und speichert ihn direkt ab.
     */
    public startNewDraft(project: Project): void {
        this.draftSignal.set(project);
        this.saveDraftToStorage(); // Direkt sichern
    }

    /**
     * Initialisiert ein brandneues Projekt-Grundgerüst direkt aus einer Note (Idee).
     * Löscht vorher sauber eventuelle alte Rückstände.
     */
    public initDraftFromIdea(idea: Note): void {
        this.clearDraft(); // Altes Draft vorher sauber löschen

        const newProj = new Project({
            title: idea.title,
            description: idea.content || '',
            status: 'Calculation',
            milestones: [],
            userId: this.userService.getCurrentUserId()?? "",
            // @ts-ignore
            ideaId: idea.id
        });

        this.startNewDraft(newProj);
        console.log(`💡 [DraftService] Sauberes Draft aus Idee "${idea.title}" erzeugt.`);
    }

    // ==========================================
    // 🪧 HELFER FÜR DAS CALCULATOR-BANNER
    // ==========================================

    public hasExistingDraftInStorage(userId: string): boolean {
        const storageKey = 'local_project_draft_' + userId;
        return localStorage.getItem(storageKey) !== null;
    }

    public getDraftTitleFromStorage(userId: string): string | null {
        const storageKey = 'local_project_draft_' + userId;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw);
            return parsed?.project?.title || null;
        } catch (e) {
            return null;
        }
    }

    // ==========================================
    // ⚡ MEILENSTEIN-MANIPULATIONEN (MUTATIONEN)
    // ==========================================

    public addMilestoneToDraft(newMilestone: Milestone, customDuration?: number): void {
        const current = this.draftSignal();
        if (!current) return;

        const currentMilestones = current.milestones ? [...current.milestones] : [];

        if (customDuration !== undefined && customDuration > 0) {
            newMilestone.duration = customDuration;
        }

        currentMilestones.push(newMilestone);

        this.draftSignal.set(new Project({
            ...current,
            milestones: currentMilestones
        }));

        // Diktat beendet -> Sofort wegschreiben!
        this.saveDraftToStorage();
    }

    public updateMilestoneInDraft(index: number, updatedFields: Partial<Milestone>): void {
        const current = this.draftSignal();
        if (!current || !current.milestones || !current.milestones[index]) return;

        const updatedMilestones = current.milestones.map((ms, i) => {
            if (i === index) return new Milestone({ ...ms, ...updatedFields });
            return ms;
        });

        this.draftSignal.set(new Project({ ...current, milestones: updatedMilestones }));
        this.saveDraftToStorage(); // Sofort sichern!
    }

    public removeMilestone(index: number): void {
        const current = this.draftSignal();
        if (!current || !current.milestones) return;

        const updatedMilestones = [...current.milestones];
        updatedMilestones.splice(index, 1);

        this.draftSignal.set(new Project({ ...current, milestones: updatedMilestones }));
        this.saveDraftToStorage(); // Sofort sichern!
    }

    public reorderMilestones(previousIndex: number, currentIndex: number, moveItemInArrayFn: Function): void {
        const current = this.draftSignal();
        if (!current || !current.milestones) return;

        const updatedMilestones = [...current.milestones];
        moveItemInArrayFn(updatedMilestones, previousIndex, currentIndex);
        updatedMilestones.forEach((ms, idx) => ms.orderIndex = idx);

        this.draftSignal.set(new Project({ ...current, milestones: updatedMilestones }));
        this.saveDraftToStorage(); // Sofort sichern!
    }

    /**
     * Alles komplett aufräumen & physisch aus dem LocalStorage tilgen!
     */
    public clearDraft(): void {
        const userId = this.userService.getCurrentUserId();
        this.draftSignal.set(null);
        this.degradedMilestonesSignal.set([]);

        if (userId) {
            const storageKey = 'local_project_draft_' + userId;
            localStorage.removeItem(storageKey);
            console.log(`🗑️ [DraftService] Entwurf physisch aus LocalStorage für User ${userId} gelöscht.`);
        }
    }
}