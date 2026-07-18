import { Injectable, signal, effect, inject } from '@angular/core';
import { Project } from '../../models/project';
import { UserService } from '../user/user-service';
import { Note } from '../../models/note';

@Injectable({
    providedIn: 'root'
})
export class ProjectDraftService {
    private userService = inject(UserService);

    // 🌟 1. Das Signal ist jetzt ÖFFENTLICH und BESCHREIBBAR! Die ultimative Source of Truth.
    public currentDraft = signal<Project | null>(null);

    // 🧠 2. Das Signal für die abgelehnten KI-Vorschläge
    private degradedMilestonesSignal = signal<string[]>([]);
    public readonly degradedMilestones = this.degradedMilestonesSignal.asReadonly();

    constructor() {
        // 🤖 DER AUTOMATISCHE SPEICHER-WÄCHTER
        // Reagiert völlig autark auf JEDE direkte Änderung am currentDraft-Signal!
        effect(() => {
            const userId = this.userService.getCurrentUserId();
            const draft = this.currentDraft();
            const degraded = this.degradedMilestonesSignal();

            // Wir sichern nur dann im LocalStorage, wenn es ein ungespeichertes Projekt (Calculation) ist
            if (userId && draft && draft.status === 'Calculation') {
                const storageKey = 'local_project_draft_' + userId;
                const wrapperData = { project: draft, degradedMilestones: degraded };
                localStorage.setItem(storageKey, JSON.stringify(wrapperData));
                console.log(`🤖 [DraftService Effect] Entwurf automatisch im Storage gesichert für User: ${userId}`);
            }
        });
    }

    /**
     * Holt den Entwurf aktiv aus dem Storage und setzt das Signal.
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
                    this.currentDraft.set(new Project(parsed.project));
                    this.degradedMilestonesSignal.set(parsed.degradedMilestones || []);
                    console.log(`📥 [DraftService] Entwurf erfolgreich aus Storage geladen.`, this.currentDraft());
                }
            } catch (e) {
                console.error('[DraftService] Fehler beim Laden des Entwurfs:', e);
            }
        }
    }

    /**
     * Initialisiert ein brandneues Projekt-Grundgerüst direkt aus einer Note (Idee).
     */
    public initDraftFromIdea(idea: Note): void {
        this.clearDraft();

    const newProj = new Project({
            title: idea.title,
            area: idea.tag?? "", 
            ideaId: idea.id?? "",
            userId: this.userService.getCurrentUserId() ?? "",
            content: idea.content || '', // 🎯 Hier! 'content' statt 'description'
            status: 'Calculation',
            milestones: []
        });
        this.currentDraft.set(newProj);
        console.log(`💡 [DraftService] Sauberes Draft aus Idee "${idea.title}" erzeugt.`);
    }

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

    /**
     * Alles komplett aufräumen & physisch aus dem LocalStorage tilgen!
     */
    public clearDraft(): void {
        const userId = this.userService.getCurrentUserId();
        this.currentDraft.set(null);
        this.degradedMilestonesSignal.set([]);

        if (userId) {
            const storageKey = 'local_project_draft_' + userId;
            localStorage.removeItem(storageKey);
            console.log(`🗑️ [DraftService] Entwurf physisch aus LocalStorage für User ${userId} gelöscht.`);
        }
    }
}