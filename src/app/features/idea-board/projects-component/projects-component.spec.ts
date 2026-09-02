import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProjectsComponent } from './projects-component';
import { ProjectService } from '../../../core/services/project/project-service';
import { TabNavigationService, BoardTab } from '../tab-navigation-service';
import { FilterService } from '../../../core/services/filter/filter-service';
import { TeamService } from '../../../core/services/team/team-service';
import { TodoService } from '../../../core/services/todo/todo-service';
import { signal } from '@angular/core';
import { Project } from '../../../core/models/project';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('ProjectsComponent (Vitest Edition)', () => {
  let component: ProjectsComponent;
  let fixture: ComponentFixture<ProjectsComponent>;

  let mockProjectService: any;
  let mockTabService: any;
  let mockTodoService: any;
  let mockFilterService: any;
  let mockTeamService: any;

  let sampleProjects: Project[];

  beforeEach(async () => {
    // 1. Echte Instanzen mit dem Inline-Konstruktor erzeugen
    const proj1 = new Project({
      id: 'proj-1',
      title: 'Manege Frei',
      userId: 'user-circus-master',
      ideaId: 'idea-1',
      area: 'Show',
      status: 'Active',
      departmentId: "dept1",
      content: 'Die große Eröffnungsshow planen'
    });
    // Dummy-Meilenstein verknüpfen (as any um komplexe Interfaces zu umgehen)
    proj1.milestones = [{ id: 'ms-1', title: 'Setup', duration: 5, usedDuration: 2, isCompleted: () => false } as any];

    const proj2 = new Project({
      id: 'proj-2',
      title: 'Raubtier-Training',
      userId: 'user-trainer',
      ideaId: 'idea-2',
      area: 'Sicherheit',
      status: 'Active',
      content: 'Löwendressur optimieren',
      departmentId: "dept1"
    });

    sampleProjects = [proj1, proj2];

    // 2. Mocks aufbauen
    mockProjectService = {
      projectsList: signal<Project[]>(sampleProjects),
      activeProjects: signal<Project[]>(sampleProjects),
      dashboardStats: signal({ totalProjects: 2, totalMilestones: 1, totalTodos: 5 }),
      removeProject: vi.fn()
    };

    mockTabService = {
      changeTab: vi.fn()
    };

    mockTodoService = {};

    mockFilterService = {
      searchTerm: signal<string>(''),
      setInitialCategory: vi.fn()
    };

    mockTeamService = {
      hasPermission: vi.fn().mockReturnValue(true)
    };

    // 3. TestBed konfigurieren
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: TabNavigationService, useValue: mockTabService },
        { provide: TodoService, useValue: mockTodoService },
        { provide: FilterService, useValue: mockFilterService },
        { provide: TeamService, useValue: mockTeamService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Triggert ngOnInit
  });

  // ==========================================================================
  // ⚡ INITIALISIERUNGS-TESTS
  // ==========================================================================
  describe('Initialisierung', () => {
    it('sollte die Komponente erfolgreich erstellen', () => {
      expect(component).toBeTruthy();
    });

    it('sollte beim Start die Filterkategorie im FilterService auf "projects" setzen', () => {
      expect(mockFilterService.setInitialCategory).toHaveBeenCalledWith('projects');
    });

    it('sollte die globalen Statistiken aus dem ProjectService korrekt auslesen', () => {
      expect(component.totalProjectsCount()).toBe(2);
      expect(component.totalMilestonesCount()).toBe(1);
      expect(component.totalTodosCount()).toBe(5);
    });
  });

  // ==========================================================================
  // 🔍 FILTERUNG & SUCH-TESTS
  // ==========================================================================
  describe('Reaktive Filterung & Suche', () => {
    it('sollte alle Projekte zurückgeben, wenn kein Suchbegriff eingegeben wurde', () => {
      mockFilterService.searchTerm.set('');
      fixture.detectChanges();
      expect(component.projects().length).toBe(2);
    });

    it('sollte Projekte nach dem Titel filtern (case-insensitive)', () => {
      mockFilterService.searchTerm.set('manege');
      fixture.detectChanges();
      const filtered = component.projects();
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Manege Frei');
    });

    it('sollte Projekte nach dem Content filtern', () => {
      mockFilterService.searchTerm.set('Löwendressur');
      fixture.detectChanges();
      const filtered = component.projects();
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('proj-2');
    });

    it('sollte Projekte nach der Area filtern', () => {
      mockFilterService.searchTerm.set('Sicherheit');
      fixture.detectChanges();
      const filtered = component.projects();
      expect(filtered.length).toBe(1);
      expect(filtered[0].area).toBe('Sicherheit');
    });

    it('sollte ein leeres Array zurückgeben, wenn kein Projekt auf den Suchbegriff passt', () => {
      mockFilterService.searchTerm.set('Clown-Schule');
      fixture.detectChanges();
      expect(component.projects().length).toBe(0);
    });
  });

  // ==========================================================================
  // 🗑️ LÖSCH-WORKFLOW-TESTS
  // ==========================================================================
  describe('Projekt-Lösch-Workflow', () => {
    it('sollte das Lösch-Popup öffnen und das Zielprojekt im State setzen', () => {
      const targetProject = sampleProjects[0];
      component.triggerDeletePopup(targetProject);
      expect(component.showDeletePopup()).toBe(true);
      expect(component.projectToDelete()).toEqual(targetProject);
    });

    it('sollte beim Abbrechen das Popup schließen und den State leeren', () => {
      component.triggerDeletePopup(sampleProjects[0]);
      component.closeDeletePopup();
      expect(component.showDeletePopup()).toBe(false);
      expect(component.projectToDelete()).toBeNull();
    });

    it('sollte beim Bestätigen das Projekt löschen und das Popup schließen', () => {
      const targetProject = sampleProjects[0];
      component.triggerDeletePopup(targetProject);
      component.confirmDelete();
      expect(component.showDeletePopup()).toBe(false);
      expect(mockProjectService.removeProject).toHaveBeenCalledWith(targetProject.id);
    });
  });

  // ==========================================================================
  // 🔄 NAVIGATION-TESTS
  // ==========================================================================
  describe('Tab-Navigation', () => {
    it('sollte zum Meilenstein-Tab navigieren mit dem Projekt-State im Gepäck', () => {
      const targetProject = sampleProjects[0];
      component.openMilestones(targetProject);
      expect(mockTabService.changeTab).toHaveBeenCalledWith(BoardTab.Milestones, {
        type: 'project',
        id: targetProject.id
      });
    });

    it('sollte direkt zu einem spezifischen Meilenstein springen können', () => {
      component.openSpecificMilestone('ms-999');
      expect(mockTabService.changeTab).toHaveBeenCalledWith(BoardTab.Milestones, {
        type: 'milestone',
        id: 'ms-999'
      });
    });

it('sollte den Benutzer direkt auf das Team-Board des Projekts schicken', () => {
      const targetProject = sampleProjects[1];

      component.openTeamBoard(targetProject);

      // 🎯 KORREKTUR: Hier muss BoardTab.team (kleingeschrieben) stehen!
      expect(mockTabService.changeTab).toHaveBeenCalledWith(BoardTab.team, {
        type: 'project',
        id: targetProject.id
      });
    });
    
    it('sollte den Re-Kalkulator mit den Projektdaten öffnen', () => {
      const targetProject = sampleProjects[0];
      component.openInCalculator(targetProject);
      expect(mockTabService.changeTab).toHaveBeenCalledWith(BoardTab.Calculator, {
        type: 'project',
        id: targetProject.id
      });
    });
  });

  // ==========================================================================
  // 🔐 BERECHTIGUNGS-TESTS
  // ==========================================================================
  describe('Benutzerrechte', () => {
    it('sollte true zurückgeben, wenn der TeamService das Löschen erlaubt', () => {
      mockTeamService.hasPermission.mockReturnValue(true);
      const canDelete = component.canDeleteProject('proj-1');
      expect(mockTeamService.hasPermission).toHaveBeenCalledWith('proj-1', 'PROJECT_DELETE');
      expect(canDelete).toBe(true);
    });

    it('sollte false zurückgeben, wenn der TeamService das Löschen verweigert', () => {
      mockTeamService.hasPermission.mockReturnValue(false);
      const canDelete = component.canDeleteProject('proj-1');
      expect(canDelete).toBe(false);
    });

    it('sollte sofort false zurückgeben, wenn keine Projekt-ID übergeben wird', () => {
      const canDelete = component.canDeleteProject('');
      expect(canDelete).toBe(false);
    });
  });
});