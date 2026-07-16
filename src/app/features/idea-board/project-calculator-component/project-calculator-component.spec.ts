import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
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

    // 1. Konstante Testdaten vorbereiten
    const sampleProject = new Project({
        id: 'proj-123',
        title: 'App-Redesign',
        userId: 'user-master',
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

    // 2. Feste Mock-Objekte deklarieren (Referenzen bleiben für das TestBed IMMER gleich!)
    const mockNotificationService = {
        showNotification: vi.fn()
    };

    const mockProjectService = {
        projectsList: signal<Project[]>([]),
        dashboardStats: signal<any>(null),
        addProjectFromCalculation: vi.fn(),
        updateProjectFromCalculation: vi.fn(),
        saveCalculatedProject: vi.fn(),
        degradeSuggestion: vi.fn(),
        loadDashboardStatistics: vi.fn(),
        _aiSuggestionsSignal: signal<any>(null),
        suggestions: signal<any>({
            recommended: [],
            degraded: []
        })
    };

    const sampleDraftSignal = signal<Project | null>(null);
    const mockProjectDraftService = {
        currentDraft: sampleDraftSignal,
        clearDraft: vi.fn(),
        saveDraftToStorage: vi.fn(),
        hasExistingDraftInStorage: vi.fn().mockReturnValue(false)
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
        getCurrentUserId: vi.fn().mockReturnValue('user-master')
    };

    const mockTeamService = {
        hasPermission: vi.fn().mockReturnValue(true)
    };

    beforeEach(async () => {
        // Vor jedem Test alle Spione/Aufrufe zurücksetzen
        vi.clearAllMocks();

        // Daten in die bestehenden Signals füllen (OHNE die Referenzen der Mocks neu zuzuweisen!)
        mockProjectService.projectsList.set([sampleProject]);
        mockNoteService.notesList.set([sampleNote]);
        sampleDraftSignal.set(sampleProject);

        // Standard-Rückgabewerte für asynchrone API-Methoden definieren
        mockProjectService.saveCalculatedProject.mockReturnValue(of(sampleProject));
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

        // Lifecycle-Hooks ausführen (OnInit etc.)
        fixture.detectChanges();
    });

    // ==========================================================================
    // 📐 BERECHNUNGS-LOGIK (computed-Signals)
    // ==========================================================================
    describe('Berechnungs-Logik (computed-Signals)', () => {
        it('sollte die Gesamtdauer (finalDays) über alle Meilensteine akkurat aufsummieren', () => {
            // Das berechnete Signal auswerten (3 + 7 = 10 Tage)
            expect(component.finalDays()).toBe(10);
        });
    });

    // ==========================================================================
    // ⚡ EVENT HANDLER & INTERAKTIONEN
    // ==========================================================================
    // ==========================================================================
    // ⚡ EVENT HANDLER & INTERAKTIONEN
    // ==========================================================================
    describe('Event Handler & Interaktionen', () => {
        it('sollte die Bearbeitung einer Phase initialisieren', () => {
            const milestone = sampleProject.milestones[0];

            // Falls startEditMilestone geschützt (protected) ist, nutzen wir compAny
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

            // 🛠️ Hier rufen wir deine echte public-Methode auf!
            component.cancelEditMilestone();

            expect(compAny.editingMilestoneId).toBeNull();
        });
    });

    // ==========================================================================
    // 💾 SPEICHERUNG & API INTERAKTION (HttpErrorResponse Handling)
    // ==========================================================================
    describe('Speicherung auf Server (Success & Error Handling)', () => {

        it('sollte beim Speichern eines brandneuen Drafts den Add-Workflow triggern', () => {
            // @ts-ignore
            component.isBrandNewDraft.set(true);

            component.handleAutoSaveConfirm();

            expect(mockProjectService.saveCalculatedProject).toHaveBeenCalledWith(sampleProject);
            expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
                expect.stringContaining('erfolgreich gestartet!'),
                'success'
            );
        });

        it('sollte Fehlerbehandlung des Servers (HttpErrorResponse) abfangen und dem User präsentieren', () => {
            // @ts-ignore
            component.isBrandNewDraft.set(true);

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
});