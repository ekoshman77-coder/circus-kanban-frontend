import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProjectStatsComponent } from './project-stats-component';
import { ProjectService } from '../../../core/services/project-service';
import { signal } from '@angular/core';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('ProjectStatsComponent (Vitest Edition)', () => {
  let component: ProjectStatsComponent;
  let fixture: ComponentFixture<ProjectStatsComponent>;

  // --- Mock für den ProjectService ---
  let mockProjectService: any;

  beforeEach(async () => {
    // 1. Wir bauen den Mock auf und spendieren ihm das reaktive dashboardStats-Signal
    mockProjectService = {
      dashboardStats: signal<any>({
        totalProjects: 12,
        totalMilestones: 34,
        totalTodos: 56
      }),
      loadDashboardStatistics: vi.fn() // Ein Spion, um den Methodenaufruf zu überwachen
    };

    // 2. Im TestBed verankern
    await TestBed.configureTestingModule({
      imports: [ProjectStatsComponent],
      providers: [
        { provide: ProjectService, useValue: mockProjectService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectStatsComponent);
    component = fixture.componentInstance;
    
    // WICHTIG: fixture.detectChanges() triggert das ngOnInit!
    fixture.detectChanges();
  });

  // ==========================================================================
  // ⚡ COMPONENT LIFE-CYCLE & INITIALISIERUNG
  // ==========================================================================
  describe('Initialisierung & Datenstrom', () => {
    it('sollte die Statistik-Komponente erfolgreich erstellen', () => {
      expect(component).toBeTruthy();
    });

    it('sollte beim Laden sofort die neuesten Statistiken vom Server/Service triggern', () => {
      // Prüft, ob ngOnInit die Methode im Service angeworfen hat
      expect(mockProjectService.loadDashboardStatistics).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // 🧮 REAKTIVE COMPUTED-SIGNALS TESTEN
  // ==========================================================================
  describe('Reaktive Kennzahlen (Computed Signals)', () => {
    it('sollte die aktiven Projekte korrekt aus dem Service-Signal mappen', () => {
      expect(component.totalProjectsCount()).toBe(12);
    });

    it('sollte die geplanten Phasen (Meilensteine) korrekt mappen', () => {
      expect(component.totalMilestonesCount()).toBe(34);
    });

    it('sollte die Gesamtanzahl aller Todos korrekt auslesen', () => {
      expect(component.totalTodosCount()).toBe(56);
    });

    // --- DER FALLBACK-TEST (Extrem wichtig für ein stabiles Portfolio!) ---
    it('sollte reaktiv auf 0 zurückfallen, falls die Dashboard-Daten im Service nicht definiert sind', () => {
      // Wir simulieren, dass das Signal plötzlich leer (null oder undefined) zurückgibt
      mockProjectService.dashboardStats.set(null);
      
      // Die Computed Signals müssen sich jetzt blitzschnell auf den Fallback 0 anpassen
      expect(component.totalProjectsCount()).toBe(0);
      expect(component.totalMilestonesCount()).toBe(0);
      expect(component.totalTodosCount()).toBe(0);
    });
  });
});