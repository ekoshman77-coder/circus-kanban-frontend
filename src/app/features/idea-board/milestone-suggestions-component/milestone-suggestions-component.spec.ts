import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MilestoneSuggestionsComponent } from './milestone-suggestions-component';
import { ProjectService } from '../../../core/services/project/project-service';
import { signal } from '@angular/core';
import { Milestone } from '../../../core/models/milestone';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('MilestoneSuggestionsComponent (Vitest Edition)', () => {
    let component: MilestoneSuggestionsComponent;
    let fixture: ComponentFixture<MilestoneSuggestionsComponent>;

    // Mock für den ProjectService vorbereiten
    const mockProjectService = {
        suggestions: signal<any>({
            recommended: [
                { title: 'Architektur-Setup', score: 95, words: ['Code'] },
                { title: 'UI-Prototyp', score: 80, words: ['Design'] }
            ],
            degraded: [
                { title: 'Kaffee kochen', score: 10, words: ['Pause'] }
            ]
        }),
        acceptSuggestion: vi.fn(),
        degradeSuggestion: vi.fn()
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        await TestBed.configureTestingModule({
            imports: [MilestoneSuggestionsComponent],
            providers: [
                { provide: ProjectService, useValue: mockProjectService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(MilestoneSuggestionsComponent);
        component = fixture.componentInstance;

        // 🟢 DER FIX: Signal-Inputs werden über componentRef.setInput() gesetzt!
        fixture.componentRef.setInput('projectTitle', 'Test-Projekt');
        fixture.componentRef.setInput('existingMilestones', []);

        fixture.detectChanges();
    });

    describe('🧠 Filter- & Anzeige-Logik (computed)', () => {
        
        it('sollte standardmäßig nur empfohlene Vorschläge anzeigen', () => {
            // degraded darf standardmäßig nicht drin sein
            expect(component.shownSuggestions().length).toBe(2);
            expect(component.shownSuggestions()[0].title).toBe('Architektur-Setup');
        });

        it('sollte Meilensteine ausblenden, die bereits im Projekt existieren (Case-Insensitive)', () => {
            // 🔥 DER FIX: Auch hier nutzen wir setInput für den Signal-Input!
            fixture.componentRef.setInput('existingMilestones', [
                new Milestone({ title: ' ui-prototyp ', duration: 2 })
            ]);

            fixture.detectChanges();

            // Es sollte nur noch das Architektur-Setup übrig bleiben
            expect(component.shownSuggestions().length).toBe(1);
            expect(component.shownSuggestions()[0].title).toBe('Architektur-Setup');
        });

        it('sollte abgewertete Meilensteine einblenden, wenn showAll aktiv ist', () => {
            // Aktiviert die Strafbank-Ansicht
            component.showAll.set(true);
            
            fixture.detectChanges();

            // Nun müssen alle 3 Vorschläge sichtbar sein (2 recommended + 1 degraded)
            expect(component.shownSuggestions().length).toBe(3);
        });
    });

    describe('⚡ Event-Ausgänge (Outputs) & Service-Aktionen', () => {

        it('sollte beim Akzeptieren den Service informieren und das Event feuern', () => {
            let emittedTitle = '';
            // Output-Event abfangen
            component.milestoneAccepted.subscribe(title => emittedTitle = title);

            component.handleAccept('Architektur-Setup');

            // Prüfen, ob der Service gerufen und das Event gefeuert wurde
            expect(mockProjectService.acceptSuggestion).toHaveBeenCalledWith('Test-Projekt', 'Architektur-Setup');
            expect(emittedTitle).toBe('Architektur-Setup');
        });

        it('sollte beim Abwerten das KI-Backend anlernen', () => {
            component.handleDegrade('Kaffee kochen');

            // Prüfen, ob die Degradierung an den Service gemeldet wurde
            expect(mockProjectService.degradeSuggestion).toHaveBeenCalledWith('Test-Projekt', 'Kaffee kochen');
        });
    });
});