import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectCalculatorComponent } from './project-calculator-component';
import { ProjectService } from '../../../core/services/project-service';
import { TabNavigationService } from '../tab-navigation-service';
import { NoteService } from '../../../core/services/note-service';
import { Project } from '../../../core/models/project';
import { Milestone } from '../../../core/models/milestone';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ProjectCalculatorComponent', () => {
  let component: ProjectCalculatorComponent;
  let fixture: ComponentFixture<ProjectCalculatorComponent>;

  // 📡 Die Mocks für Vitest absolut passgenau auf deine echten Services abgestimmt
  let mockProjectService: any;
  let mockTabService: any;
  let mockNoteService: any;

  beforeEach(async () => {
    mockProjectService = {
      projectsList: signal([]),
      // Nutzt die exakten Methodennamen aus deinem project-service.ts!
      saveCalculatedProject: vi.fn().mockReturnValue({ subscribe: (cb: any) => cb('new-id') }),
      updateCalculatedProject: vi.fn().mockReturnValue({ subscribe: (cb: any) => cb() })
    };

    mockTabService = {
      currentNavigationState: signal(null),
      changeTab: vi.fn()
    };

    mockNoteService = {
      notesList: signal([])
    };

    await TestBed.configureTestingModule({
      imports: [ProjectCalculatorComponent],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: TabNavigationService, useValue: mockTabService },
        { provide: NoteService, useValue: mockNoteService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectCalculatorComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // 📐 TEST 1: Schützt das reaktive computed() Signal vor String-Verkettungen
it('should correctly calculate total duration as a number and not concatenate strings', () => {
  const testProject = new Project({
    id: 'proj-123',
    ideaId: 'idea-456',
    title: 'Angular lernen',
    area: 'Frontend',
    milestones: [
      new Milestone({ id: 'm1', title: 'Task 1', duration: 5 }),
      // Wir simulieren den HTML-Eingabefall, bei dem die Dauer fälschlicherweise als String durchrutscht
      new Milestone({ id: 'm2', title: 'Task 2', duration: '3' as any })
    ]
  });

  // 1. ✅ Richtig befüllen: Wir setzen das beschreibbare Signal, auf das die Lese-Brille schaut!
  (component as any).localEditProject.set(testProject);

  // 2. 🧮 Direkt die mathematische Absicherung des Modells prüfen
  expect(testProject.getTotalDuration()).toBe(8);

  // läuft das jetzt auch butterweich durch:
   expect(component.totalTime()).toBe(8);
});

  // ✏️ TEST 2: Überprüft das Inline-Editing der Meilensteine direkt in der Tabelle
  it('should update milestone data and close edit mode when saving an inline edit', () => {
    const originalMilestone = new Milestone({ id: 'm1', title: 'Altes Design', duration: 2 });
    const testProject = new Project({
      id: 'proj-123',
      ideaId: 'idea-456',
      title: 'Projekt',
      area: 'Design',
      milestones: [originalMilestone]
    });
    
    (component as any).localEditProject.set(testProject);

    // Bearbeitungsmodus für diesen Meilenstein starten
    component.startEditMilestone(originalMilestone);
    component.editTitle = 'Neues verbessertes Design';
    component.editTime = 6;

    // Speichern ausführen
    component.saveEditMilestone('m1');

    // Das Signal muss nun die aktualisierten Werte beinhalten
    const updatedMilestones = component.localProjectDraft()?.milestones;
    expect(updatedMilestones?.[0].title).toBe('Neues verbessertes Design');
    expect(updatedMilestones?.[0].duration).toBe(6);
    expect(component.editingMilestoneId).toBeNull(); // Der Editor muss geschlossen sein
  });
});