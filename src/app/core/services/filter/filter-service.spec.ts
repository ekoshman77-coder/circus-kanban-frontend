import { TestBed } from '@angular/core/testing';
import { FilterService, SearchCategory } from './filter-service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FilterService]
    });
    service = TestBed.inject(FilterService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  it('sollte mit korrekten Standardwerten initialisieren', () => {
    expect(service.searchTerm()).toBe('');
    expect(service.currentCategory()).toBe('all');
    expect(service.showOnlyAlerts()).toBe(false);
  });

  describe('setInitialCategory', () => {
    it('sollte die Kategorie setzen und andere Filter bereinigen', () => {
      // 1. Erst "schmutzigen" Zustand simulieren
      service.searchTerm.set('Suchbegriff');
      service.showOnlyAlerts.set(true);

      // 2. Initialen Zustand für eine neue Seite setzen
      service.setInitialCategory('projects');

      // 3. Verifizieren, dass die Kategorie stimmt und alles andere zurückgesetzt wurde
      expect(service.currentCategory()).toBe('projects');
      expect(service.searchTerm()).toBe('');
      expect(service.showOnlyAlerts()).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('sollte alle Filter auf ihre Standard-Ausgangswerte zurücksetzen', () => {
      // 1. Filter verändern
      service.searchTerm.set('Zirkus');
      service.currentCategory.set('milestones');
      service.showOnlyAlerts.set(true);

      // 2. Reset triggern
      service.resetAll();

      // 3. Alle Werte müssen wieder standardisiert sein
      expect(service.searchTerm()).toBe('');
      expect(service.currentCategory()).toBe('all');
      expect(service.showOnlyAlerts()).toBe(false);
    });
  });
});