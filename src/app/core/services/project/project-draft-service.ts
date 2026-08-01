import { Injectable, signal, effect, inject } from '@angular/core';
import { Project } from '../../models/project';
import { UserService } from '../user/user-service';
import { Note } from '../../models/note';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

/**
 * Service zur Verwaltung ungespeicherter Projektentwürfe im lokalen Speicher (LocalStorage).
 * Verhindert Datenverlust bei unerwartetem Neuladen der Seite während der Kalkulationsphase.
 */
@Injectable({
    providedIn: 'root'
})
export class ProjectDraftService extends BaseDataManager {
    private userService = inject(UserService);

    /**
     * Das reaktive Signal, welches den aktuellen Projektentwurf hält.
     * Dient als globale 'Source of Truth' für die aktive Kalkulation.
     */
    public currentDraft = signal<Project | null>(null);

    /**
     * Internes Signal für zurückgestufte oder abgelehnte Meilensteine.
     */
    private degradedMilestonesSignal = signal<string[]>([]);
    
    /**
     * Schreibgeschützter Zugriff auf die Liste der zurückgestuften Meilensteine.
     */
    public readonly degradedMilestones = this.degradedMilestonesSignal.asReadonly();

    constructor() {
        super()
        /**
         * Reagiert automatisch auf Änderungen an den Draft-Signalen 
         * und synchronisiert den Zustand mit dem LocalStorage.
         */
        effect(() => {
            const userId = this.userService.getCurrentUserId();
            const draft = this.currentDraft();
            const degraded = this.degradedMilestonesSignal();

            if (userId && draft && draft.status === 'Calculation') {
                const storageKey = `local_project_draft_${userId}`;
                const wrapperData = { project: draft, degradedMilestones: degraded };
                localStorage.setItem(storageKey, JSON.stringify(wrapperData));
            }
        });
    }

    /**
     * Lädt einen existierenden Entwurf aus dem LocalStorage und setzt die entsprechenden Signale.
     */
    public loadDraftFromStorageIntoSignal(): void {
        const userId = this.userService.getCurrentUserId();
        if (!userId) return;

        const storageKey = `local_project_draft_${userId}`;
        const raw = localStorage.getItem(storageKey);
        
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed?.project) {
                    this.currentDraft.set(new Project(parsed.project));
                    this.degradedMilestonesSignal.set(parsed.degradedMilestones || []);
                }
            } catch (e) {
                console.error('[ProjectDraftService] Fehler beim Parsen des Entwurfs:', e);
            }
        }
    }

    /**
     * Initialisiert einen neuen Projektentwurf basierend auf einer bestehenden Idee (Note).
     * Setzt den Status automatisch auf 'Calculation'.
     * 
     * @param idea Die zugrundeliegende Notiz/Idee für das neue Projekt.
     */
    public initDraftFromIdea(idea: Note): void {
        this.clearDraft();

        const newProj = new Project({
            title: idea.title,
            area: idea.tag ?? '', 
            ideaId: idea.id ?? '',
            departmentId: this.userService.currentUser()?.departmentId?? "",
            userId: this.userService.getCurrentUserId() ?? '',
            content: idea.content || '',
            status: 'Calculation',
            milestones: []
        });
        
        this.currentDraft.set(newProj);
    }

    /**
     * Prüft, ob für die übergebene Benutzer-ID ein Entwurf im LocalStorage existiert.
     * 
     * @param userId Die ID des aktuellen Benutzers.
     * @returns True, wenn ein Entwurf existiert, andernfalls false.
     */
    public hasExistingDraftInStorage(userId: string): boolean {
        const storageKey = `local_project_draft_${userId}`;
        return localStorage.getItem(storageKey) !== null;
    }

    /**
     * Holt den Titel des gespeicherten Projektentwurfs aus dem LocalStorage, ohne das Signal zu verändern.
     * Wird primär für UI-Banner-Meldungen verwendet.
     * 
     * @param userId Die ID des aktuellen Benutzers.
     * @returns Den Projekttitel oder null, falls kein Entwurf existiert.
     */
    public getDraftTitleFromStorage(userId: string): string | null {
        const storageKey = `local_project_draft_${userId}`;
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
     * Setzt alle Signale zurück und löscht den Entwurf physisch aus dem LocalStorage.
     */
    public clearDraft(): void {
        const userId = this.userService.getCurrentUserId();
        this.currentDraft.set(null);
        this.degradedMilestonesSignal.set([]);

        if (userId) {
            const storageKey = `local_project_draft_${userId}`;
            localStorage.removeItem(storageKey);
        }
    }

    public override resetData(): void {
        this.currentDraft.set(null);
        this.degradedMilestonesSignal.set([]);
    }
}