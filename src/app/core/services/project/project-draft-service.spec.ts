import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectDraftService } from './project-draft-service';
import { UserService } from '../user/user-service';
import { Project } from '../../models/project';
import { Note } from '../../models/note';

describe('ProjectDraftService', () => {
    let service: ProjectDraftService;
    // Wir erstellen einen sauberen Mock-Typen
    let userServiceMock: { 
        getCurrentUserId: ReturnType<typeof vi.fn>;
        currentUser: ReturnType<typeof vi.fn>; // 🟢 Signal-Mock ergänzt
    };

    const mockUserId = 'user_123';

    let store: Record<string, string> = {};
    const localStorageMock = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };

    beforeEach(() => {
        // 2. Wir zwingen Vitest, unseren Mock global für 'localStorage' einzusetzen
        vi.stubGlobal('localStorage', localStorageMock);

        // 3. Jetzt leeren wir unseren Mock-Speicher vor jedem Testlauf
        localStorage.clear();

        // 4. Angular TestBed zurücksetzen und neu konfigurieren
        TestBed.resetTestingModule();

        // Wir erstellen einen sauberen Mock-Typen
        userServiceMock = {
            getCurrentUserId: vi.fn().mockReturnValue(mockUserId),
            // 🟢 Neu: Liefert ein Objekt mit passender Department-ID zurück
            currentUser: vi.fn().mockReturnValue({ department: { id: 'dept-123' } })
        };

        TestBed.configureTestingModule({
            providers: [
                ProjectDraftService,
                { provide: UserService, useValue: userServiceMock }
            ]
        });

        service = TestBed.inject(ProjectDraftService);
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        // Entfernt globale Stubs wie unseren localStorage-Mock nach der Testdatei wieder
        vi.unstubAllGlobals();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should initialize an empty draft and signals', () => {
        expect(service.currentDraft()).toBeNull();
        expect(service.degradedMilestones()).toEqual([]);
    });

    it('should initialize draft from an idea (Note)', () => {
        const mockIdea: Note = {
            id: 'note_99',
            title: 'Test-Idee',
            tag: 'IT',
            userId: "123",
            colorType: "note-yellow",
            content: 'Das ist eine Test-Beschreibung',
            scope: "department",
            departmentId: "dept 1"
        };

        service.initDraftFromIdea(mockIdea);

        const current = service.currentDraft();
        expect(current).toBeTruthy();
        expect(current?.title).toBe('Test-Idee');
        expect(current?.area).toBe('IT');
        expect(current?.status).toBe('Calculation');
        expect(current?.userId).toBe(mockUserId);
    });

    it('should detect if a draft exists in storage', () => {
        const storageKey = `local_project_draft_${mockUserId}`;

        expect(service.hasExistingDraftInStorage(mockUserId)).toBe(false);

        localStorage.setItem(storageKey, JSON.stringify({ project: { title: 'Existiert' } }));
        expect(service.hasExistingDraftInStorage(mockUserId)).toBe(true);
    });

    it('should retrieve the draft title from storage', () => {
        const storageKey = `local_project_draft_${mockUserId}`;

        expect(service.getDraftTitleFromStorage(mockUserId)).toBeNull();

        localStorage.setItem(storageKey, JSON.stringify({ project: { title: 'Geheimes Projekt' } }));
        expect(service.getDraftTitleFromStorage(mockUserId)).toBe('Geheimes Projekt');
    });

    it('should load draft from storage into signals', () => {
        const storageKey = `local_project_draft_${mockUserId}`;
        const mockSavedData = {
            project: { title: 'Geladenes Projekt', status: 'Calculation', milestones: [] },
            degradedMilestones: ['milestone_1']
        };

        localStorage.setItem(storageKey, JSON.stringify(mockSavedData));

        service.loadDraftFromStorageIntoSignal();

        expect(service.currentDraft()).toBeTruthy();
        expect(service.currentDraft()?.title).toBe('Geladenes Projekt');
        expect(service.degradedMilestones()).toEqual(['milestone_1']);
    });

    it('should clear draft and remove it from localStorage', () => {
        const storageKey = `local_project_draft_${mockUserId}`;

        // Vollständig typisiertes Modell passend zu eurem Constructor
        const testProject = new Project({
            title: 'Test Projekt',
            ideaId: 'idea-123',
            userId: 'user-123',
            area: 'Tech',
            departmentId: 'dept-123' // 👈 Das geforderte Pflichtfeld hat hier gefehlt!
        });

        service.currentDraft.set(testProject);
        localStorage.setItem(storageKey, JSON.stringify({ project: testProject }));

        service.clearDraft();

        expect(service.currentDraft()).toBeNull();
        expect(localStorage.getItem(storageKey)).toBeNull();
    });

    it('should automatically save to localStorage when currentDraft signal changes', () => {
        // 1. Wir erstellen das Test-Projekt
        const testProject = new Project({
            title: 'Reaktives Projekt',
            status: 'Calculation', // Erfüllt die Bedingung im Effekt!
            ideaId: 'idea_456',
            userId: mockUserId,
            area: 'Entwicklung',
            departmentId: "dept"
        });

        // 2. Wir ändern das Signal (das triggert den Effekt im Hintergrund)
        service.currentDraft.set(testProject);

        // 3. Wir zwingen Angular, den Effekt sofort auszuführen
        TestBed.flushEffects();

        // 4. DER SPEICHER-SCHLÜSSEL
        // Wie heißt der Key im localStorage? (Tipp: Schau dir den Service-Code an)
        const expectedKey = `local_project_draft_${mockUserId}`;

        // 5. DIE PRÜFUNG
        // Wir holen uns das, was im store gelandet ist.
        const savedRawData = localStorage.getItem(expectedKey);

        // Jetzt du: 
        // A) Prüfe, ob überhaupt etwas gespeichert wurde (sollte nicht null sein!)
        expect(savedRawData).toBeTruthy();

        // B) Der Effekt verpackt das Projekt in ein "wrapperData"-Objekt { project: draft, ... }
        // Wir parsen den String zurück in ein Objekt:
        const parsedData = JSON.parse(savedRawData!);

        // Prüfe, ob der Titel des gespeicherten Projekts 'Reaktives Projekt' entspricht!
        expect(parsedData.project.title).toBe('Reaktives Projekt');
    });
});