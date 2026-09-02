import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProjectCalculatorComponent } from './project-calculator-component';
import { ProjectService } from '../../../core/services/project/project-service';
import { NoteService } from '../../../core/services/note/note-service';
import { TabNavigationService, BoardTab } from '../tab-navigation-service';
import { TodoService } from '../../../core/services/todo/todo-service';
import { UserService } from '../../../core/services/user/user-service';
import { ProjectDraftService } from '../../../core/services/project/project-draft-service';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { TeamService } from '../../../core/services/team/team-service';
import { signal } from '@angular/core';
import { Project } from '../../../core/models/project';
import { Milestone } from '../../../core/models/milestone';
import { Note } from '../../../core/models/note';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('ProjectCalculatorComponent (Vitest Edition)', () => {
    let component: ProjectCalculatorComponent;
    let fixture: ComponentFixture<ProjectCalculatorComponent>;

    const sampleProject = new Project({
        id: 'proj-123',
        title: 'App-Redesign',
    userId: 'user-master',
    departmentId: 'dep-it-01',
    scope: 'DEPARTMENT', // 👈 Scope explizit übergeben
    ideaId: 'idea-99',
    area: 'Frontend',
    milestones: [
        new Milestone({ id: 'ms-1', title: 'Design-Mockups', duration: 3, usedDuration: 1 }),
        new Milestone({ id: 'ms-2', title: 'Coding & Testing', duration: 7, usedDuration: 0 })
    ]
});
    const sampleNote = new Note({
        id: 'idea-99',
        title: 'Cooles Redesign für App',
        content: 'Wir müssen die Buttons runder machen!',
        userId: 'user-master',
        colorType: 'blue',
        tag: 'Design',
        isInCalculation: false,
        temperature: null,
        weatherCode: null
    });

    const mockNotificationService = {
        showNotification: vi.fn()
    };

    const mockProjectService = {
        projectsList: signal<Project[]>([]),
        dashboardStats: signal<any>(null),
        loadProjects: vi.fn(),
        addProjectFromCalculation: vi.fn(),
        updateProjectFromCalculation: vi.fn(),
        saveCalculatedProject: vi.fn(),
        updateCalculatedProject: vi.fn(), // 🟢 JETZT VORHANDEN!
        degradeSuggestion: vi.fn(),
        loadDashboardStatistics: vi.fn(),
        _aiSuggestionsSignal: signal<any>(null),
        suggestions: signal<any>({
            recommended: [],
            degraded: []
        }),
        acceptSuggestion: vi.fn(),
        cleanSuggestions: vi.fn(),
        loadMilestoneSuggestions: vi.fn()
    };

    const sampleDraftSignal = signal<Project | null>(null);
    const mockProjectDraftService = {
        currentDraft: sampleDraftSignal,
        clearDraft: vi.fn(),
        saveDraftToStorage: vi.fn(),
        hasExistingDraftInStorage: vi.fn().mockReturnValue(false),
        getDraftTitleFromStorage: vi.fn(),
        loadDraftFromStorageIntoSignal: vi.fn(),
        initDraftFromIdea: vi.fn()
    };

    const mockNoteService = {
        notesList: signal<Note[]>([]),
        getNotesReactive: vi.fn()
    };

    const mockTabService = {
        activeTab: signal<BoardTab>(BoardTab.Calculator),
        changeTab: vi.fn(),
        currentParams: signal<any>({}),
        currentNavigationState: signal<any>(null)
    };

    const mockTodoService = {
        todos: signal<any[]>([]),
        loadTodosForProject: vi.fn()
    };

    const mockUserService = {
        getCurrentUserId: vi.fn().mockReturnValue('user-master'),
        isAdmin: vi.fn().mockReturnValue(false),
        isLoggedIn: vi.fn().mockReturnValue(true)
    };

    const mockTeamService = {
        hasPermission: vi.fn().mockReturnValue(true),
        setCurrentProject: vi.fn() // 🟢 WICHTIG: Für die Sync in handleNavigationStateChange!
    };

    let store: Record<string, string> = {};

    beforeEach(async () => {
        vi.clearAllMocks();

        store = {};
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, value: string) => { store[key] = value; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { store = {}; }
        });

        mockProjectService.projectsList.set([sampleProject]);
        mockNoteService.notesList.set([sampleNote]);
        sampleDraftSignal.set(sampleProject);

        mockProjectService.saveCalculatedProject.mockReturnValue(of(sampleProject));
        mockProjectService.updateCalculatedProject.mockReturnValue(of(sampleProject));
        mockProjectService.addProjectFromCalculation.mockReturnValue(of(sampleProject));
        mockProjectService.updateProjectFromCalculation.mockReturnValue(of(sampleProject));

        await TestBed.configureTestingModule({
            imports: [ProjectCalculatorComponent],
            providers: [
                { provide: ProjectService, useValue: mockProjectService },
                { provide: NoteService, useValue: mockNoteService },
                { provide: TabNavigationService, useValue: mockTabService },
                { provide: TodoService, useValue: mockTodoService },
                { provide: UserService, useValue: mockUserService },
                { provide: ProjectDraftService, useValue: mockProjectDraftService },
                { provide: NotificationService, useValue: mockNotificationService },
                { provide: TeamService, useValue: mockTeamService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ProjectCalculatorComponent);
        component = fixture.componentInstance;

        fixture.detectChanges();
    });

    describe('Berechnungs-Logik (computed-Signals)', () => {
        it('sollte die Gesamtdauer (finalDays) über alle Meilensteine akkurat aufsummieren', () => {
            expect(component.finalDays()).toBe(10);
        });
    });

    describe('Event Handler & Interaktionen', () => {
        it('sollte die Bearbeitung einer Phase initialisieren', () => {
            const milestone = sampleProject.milestones[0];
            const compAny = component as any;
            
            compAny.startEditMilestone(milestone);

            expect(compAny.editingMilestoneId).toBe(milestone.id);
            expect(compAny.editTitle).toBe(milestone.title);
            expect(compAny.editTime).toBe(milestone.duration);
        });

        it('sollte Änderungen verwerfen können', () => {
            const milestone = sampleProject.milestones[0];
            const compAny = component as any;

            compAny.startEditMilestone(milestone);
            component.cancelEditMilestone();

            expect(compAny.editingMilestoneId).toBeNull();
        });
    });

    describe('3-Projekt-Zustände & Speicherung auf Server', () => {
        it('Fall 1: sollte beim Speichern eines echten neuen Idee-Drafts (nicht in DB) saveCalculatedProject triggern', () => {
            // Projekt liegt NICHT in projectsList -> echte Neu-Kalkulation
            mockProjectService.projectsList.set([]); 
            
            const newIdeaDraft = new Project({
                title: 'Neuer Entwurf aus Idee',
                userId: 'user-master',
                departmentId: 'dep-1',
                area: 'Design',
                ideaId: 'idea-99',
                milestones: [new Milestone({ title: 'Schritt 1', duration: 2 })]
            });
            sampleDraftSignal.set(newIdeaDraft);

            component.handleAutoSaveConfirm();

            expect(mockProjectService.saveCalculatedProject).toHaveBeenCalledWith(newIdeaDraft);
            expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
                expect.stringContaining('erfolgreich kalkuliert und gestartet!'),
                'success'
            );
        });

        it('Fall 2 & 3: sollte bei bestehenden DB-Projekten updateCalculatedProject aufrufen', () => {
            // sampleProject (proj-123) existiert in projectsList -> muss geupdatet werden!
            mockProjectService.projectsList.set([sampleProject]);

            component.handleAutoSaveConfirm();

            expect(mockProjectService.updateCalculatedProject).toHaveBeenCalledWith(sampleProject);
            expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
                expect.stringContaining('wurden gespeichert!'),
                'success'
            );
        });

        it('sollte Fehlerbehandlung des Servers (HttpErrorResponse) abfangen und dem User präsentieren', () => {
            // Projekt ist neu
            mockProjectService.projectsList.set([]);
            
            const errorResponse = new HttpErrorResponse({
                error: { message: 'Der Projektname ist leider unzulässig!' },
                status: 400,
                statusText: 'Bad Request'
            });
            mockProjectService.saveCalculatedProject.mockReturnValue(throwError(() => errorResponse));

            component.handleAutoSaveConfirm();

            expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
                'Der Projektname ist leider unzulässig!',
                'error'
            );
        });
    });
    it('Fall 2 (Company-Scope): sollte ein von Admin erzeugtes Company-Stub-Projekt laden, TeamService synchronisieren und updateCalculatedProject aufrufen', () => {
    // 1. Admin erstellt Company-Projekt ohne Meilensteine
    const companyAdminStub = new Project({
        id: 'proj-company-stub',
        title: 'Unternehmensweite KI-Initiative',
        userId: 'admin-user',
        departmentId: 'dep-global',
        scope: 'COMPANY', // 👈 Unternehmensebene
        area: 'Strategie',
        ideaId: '',
        milestones: [] // Leeres DB-Projekt / Stub
    });

    // Projekt existiert in der DB-Liste
    mockProjectService.projectsList.set([companyAdminStub]);

    // Navigations-State simulieren (PM öffnet das Admin-Projekt)
    const compAny = component as any;
    compAny.handleNavigationStateChange({ type: 'project', id: 'proj-company-stub' }, 'pm-user-123');

    // Assert: Zustand & TeamService-Sync
    expect(component['isBrandNewDraft']()).toBe(true); // UI zeigt Draft/Kalkulationsmodus
    expect(component.isExistingDbProject()).toBe(true); // DB-Erkennung muss greifen!
    expect(mockTeamService.setCurrentProject).toHaveBeenCalledWith('proj-company-stub');

    // 2. PM fügt im Calculator erste Meilensteine hinzu & speichert
    component.onMilestoneAdded('Initiales Audit & Kickoff', 5);
    component.handleAutoSaveConfirm();

    // Assert: Es darf KEIN neues Projekt erzeugt werden (POST), sondern ein Update (PUT)
    expect(mockProjectService.updateCalculatedProject).toHaveBeenCalledWith(
        expect.objectContaining({
            id: 'proj-company-stub',
            scope: 'COMPANY'
        })
    );
    expect(mockProjectService.saveCalculatedProject).not.toHaveBeenCalled();
});
});