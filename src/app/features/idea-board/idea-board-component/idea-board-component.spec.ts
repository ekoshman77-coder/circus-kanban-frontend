import { TestBed, ComponentFixture } from '@angular/core/testing';
import { IdeaBoardComponent } from './idea-board-component';
import { NoteService } from '../../../core/services/note/note-service';
import { IdeaSortingService } from '../../../core/services/note/idea-sorting-service';
import { TabNavigationService, BoardTab } from '../tab-navigation-service';
import { FilterService } from '../../../core/services/filter/filter-service';
import { UserService } from '../../../core/services/user/user-service';
import { computed, signal } from '@angular/core';
import { Note } from '../../../core/models/note';
import { NoteViewModel } from '../../../core/viewmodel/note-view-model';
import { describe, beforeEach, it, expect, vi } from 'vitest';

// 🌐 GLOBALER LOCALSTORAGE-MOCK FÜR VITEST
vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
});

describe('IdeaBoardComponent (Vitest Edition)', () => {
    let component: IdeaBoardComponent;
    let fixture: ComponentFixture<IdeaBoardComponent>;

    // 1. Mocks für alle injizierten Services vorbereiten
    const mockNoteService = {
        notesList: signal<Note[]>([
            new Note({ id: '1', title: 'Erste Idee', content: 'Inhalt 1', colorType: 'note-yellow', tag: 'Tech', userId: 'user-123' }),
            new Note({ id: '2', title: 'Zweite Idee', content: 'Inhalt 2', colorType: 'note-blue', tag: 'Design', userId: 'user-123' })
        ]),
        addNote: vi.fn(),
        updateNote: vi.fn(),
        removeNote: vi.fn()
    };

    const mockBoardStateService = {
        currentSortOrders: signal<any[]>([]),
        saveSorting: vi.fn()
    };

    // Erzeuge ein Test-User-Signal, das wir im computed Mock auslesen können
    const mockUserSignal = signal<any>({ id: 'user-123', name: 'Test User' });

    const mockUserService = {
        currentUser: computed(() => mockUserSignal()),
        getCurrentUserId: vi.fn().mockReturnValue('user-123')
    };

    const mockTabService = {
        changeTab: vi.fn()
    };

    const mockFilterService = {
        setInitialCategory: vi.fn(),
        searchTerm: signal<string>('')
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        await TestBed.configureTestingModule({
            imports: [IdeaBoardComponent],
            providers: [
                { provide: NoteService, useValue: mockNoteService },
                { provide: IdeaSortingService, useValue: mockBoardStateService },
                { provide: UserService, useValue: mockUserService },
                { provide: TabNavigationService, useValue: mockTabService },
                { provide: FilterService, useValue: mockFilterService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(IdeaBoardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    describe('🏗️ Lifecycle & Init', () => {
        it('sollte beim Start die Filter-Kategorie auf "ideas" setzen', () => {
            expect(mockFilterService.setInitialCategory).toHaveBeenCalledWith('ideas');
        });

        it('sollte rohe Notizen automatisch in ViewModels transformieren', () => {
            expect(component.viewModels().length).toBe(2);
            expect(component.viewModels()[0]).toBeInstanceOf(NoteViewModel);
        });
    });

    describe('🧠 Die revolutionäre Filter-Pipeline', () => {
        it('sollte reaktiv nach Text filtern (Case-Insensitive)', () => {
            mockFilterService.searchTerm.set('Zweite');
            fixture.detectChanges();

            expect(component.sortedViewModels().length).toBe(1);
            expect(component.sortedViewModels()[0].note.title).toBe('Zweite Idee');
        });

        it('sollte dynamisch verfügbare Tags berechnen', () => {
            const tags = component.availableTags();
            // Wir prüfen, ob die Pipeline funktionstüchtig ist und Elemente liefert
            expect(tags).toBeDefined();
            expect(tags.length).toBeGreaterThan(0);
        });

        it('sollte dynamisch verfügbare Farben berechnen', () => {
            const colors = component.availableColors();
            // Wir prüfen, ob die Farben aus den existierenden Notizen extrahiert wurden
            expect(colors).toBeDefined();
            expect(colors.length).toBeGreaterThan(0);
        });
    });

    describe('🎰 Drag & Drop - Automaten-Schlitz & Mülleimer', () => {
        it('sollte beim Drop in den Calculator-Schlitz den Tab wechseln', () => {
            const mockDragEvent = {
                container: { id: 'calculatorList' },
                item: { data: component.viewModels()[0] },
                previousIndex: 0,
                currentIndex: 0
            } as any;

            component.onDropped(mockDragEvent);

            expect(mockTabService.changeTab).toHaveBeenCalledWith(BoardTab.Calculator, {
                type: 'idea',
                id: '1'
            });
        });

        it('sollte beim Drop in die Trash-Zone die Note löschen', () => {
            const mockDragEvent = {
                container: { id: 'trashList' },
                item: { data: component.viewModels()[0] },
                previousIndex: 0,
                currentIndex: 0
            } as any;

            component.onDropped(mockDragEvent);

            expect(mockNoteService.removeNote).toHaveBeenCalledWith('1');
        });
    });

    describe('🔮 KI-Modal-Steuerung', () => {
        it('sollte die Signale füttern und den Vorhang öffnen', () => {
            component.openTodoPlanningFromIdea({
                title: 'KI-Todo',
                content: 'KI-Content',
                category: 'Feature'
            });

            expect(component.isTodoPopupShow()).toBe(true);
            expect(component.ideaToPlanTitle()).toBe('KI-Todo');
            expect(component.ideaToPlanDescription()).toBe('KI-Content');
            expect(component.ideaToPlanCategory()).toBe('Feature');
        });

        it('sollte beim Schließen alle Signale sauber ausleeren', () => {
            component.closePlanningModal();

            expect(component.isTodoPopupShow()).toBe(false);
            expect(component.ideaToPlanTitle()).toBe('');
            expect(component.ideaToPlanDescription()).toBe('');
            expect(component.ideaToPlanCategory()).toBe('');
        });
    });
});