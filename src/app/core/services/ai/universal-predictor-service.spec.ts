import { TestBed } from '@angular/core/testing';
import { UniversalPredictorService } from './universal-predictor-service';
import { AiRepository } from '../../repositories/ai-repository';
import { ConnectionService } from '../connection/connection-service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

describe('UniversalPredictorService', () => {
  let service: UniversalPredictorService;
  
  // Mocks
  let mockAiRepository: any;
  let mockConnectionService: any;
  let connectionStatusSignal: any;
  
  // Ein lokaler Speicher-Ersatz für den Testlauf
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};

    // Wir mocken localStorage sicherheitshalber komplett, damit der Test in JEDER Umgebung (Node/Browser) fehlerfrei läuft
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      length: 0,
      key: (index: number) => null
    });

    connectionStatusSignal = signal<'ONLINE' | 'OFFLINE'>('ONLINE');
    mockConnectionService = {
      status: connectionStatusSignal
    };

    mockAiRepository = {
      getServerPrediction: vi.fn().mockReturnValue(of({ suggestedCategory: 'Arbeit' })),
      getServerEffortPrediction: vi.fn().mockReturnValue(of({ suggestedEffort: 4 })),
      getServerCategories: vi.fn().mockReturnValue(of(['Sport', 'Freizeit']))
    };

    TestBed.configureTestingModule({
      providers: [
        UniversalPredictorService,
        { provide: AiRepository, useValue: mockAiRepository },
        { provide: ConnectionService, useValue: mockConnectionService }
      ]
    });

    service = TestBed.inject(UniversalPredictorService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('predict (Kategorie-Vorhersage)', () => {
    it('sollte sofort einen leeren String liefern, wenn der Text zu kurz ist', async () => {
      const result = await service.predict('ab', 'u1', 'todo');
      expect(result).toBe('');
    });

    it('sollte im ONLINE-Modus die Vorhersage vom Server holen', async () => {
      connectionStatusSignal.set('ONLINE');
      const result = await service.predict('Datenbank aufsetzen', 'u1', 'todo');
      
      expect(result).toBe('Arbeit');
      expect(mockAiRepository.getServerPrediction).toHaveBeenCalledWith('Datenbank aufsetzen', 'todo');
    });

    it('sollte im OFFLINE-Modus die Vorhersage heuristisch aus dem LocalStorage berechnen', async () => {
      connectionStatusSignal.set('OFFLINE');

      // Wir simulieren gelagerte Todos im LocalStorage-Mock
      const localTodos = [
        { title: 'Kuchen backen', description: 'Rezept suchen', category: 'Küche' },
        { title: 'Projekt planen', description: 'Meilensteine definieren', category: 'Arbeit' }
      ];
      localStorage.setItem('local_todos_u1', JSON.stringify(localTodos));

      // "backen" matcht das erste Todo -> Kategorie "Küche"
      const result = await service.predict('Zutaten fürs backen kaufen', 'u1', 'todo');
      expect(result).toBe('Küche');
      expect(mockAiRepository.getServerPrediction).not.toHaveBeenCalled();
    });

    it('sollte bei einem Serverfehler im ONLINE-Modus nahtlos auf den LocalStorage zurückgreifen', async () => {
      connectionStatusSignal.set('ONLINE');
      mockAiRepository.getServerPrediction.mockReturnValue(throwError(() => new Error('KI offline')));

      const localNotes = [
        { title: 'Meeting Notizen', content: 'Neues Design besprechen', tag: 'Design' }
      ];
      localStorage.setItem('local_notes_u1', JSON.stringify(localNotes));

      const result = await service.predict('Design Entwurf', 'u1', 'note');
      expect(result).toBe('Design');
    });
  });

  describe('predictEffort (Aufwandsschätzung)', () => {
    it('sollte im ONLINE-Modus den Aufwand schätzen', async () => {
      connectionStatusSignal.set('ONLINE');
      const result = await service.predictEffort('Unit Tests schreiben');
      
      expect(result).toBe(4);
      expect(mockAiRepository.getServerEffortPrediction).toHaveBeenCalledWith({
        text: 'Unit Tests schreiben',
        contextType: 'todo'
      });
    });

    it('sollte offline oder bei Serverfehler null zurückgeben', async () => {
      connectionStatusSignal.set('OFFLINE');
      const result = await service.predictEffort('Unit Tests schreiben');
      expect(result).toBeNull();
    });
  });

  describe('getAvailableCategories', () => {
    it('sollte im ONLINE-Modus Kategorien vom Server holen', async () => {
      connectionStatusSignal.set('ONLINE');
      const result = await service.getAvailableCategories('u1', 'todo', ['Allgemein']);
      
      expect(result).toEqual(['Sport', 'Freizeit']);
    });

    it('sollte im OFFLINE-Modus einzigartige Kategorien aus dem LocalStorage filtern', async () => {
      connectionStatusSignal.set('OFFLINE');

      const localTodos = [
        { category: 'Haushalt' },
        { category: 'Arbeit' },
        { category: 'Haushalt' } // Duplikat
      ];
      localStorage.setItem('local_todos_u1', JSON.stringify(localTodos));

      const result = await service.getAvailableCategories('u1', 'todo', ['Allgemein']);
      expect(result).toEqual(['Arbeit', 'Haushalt']);
    });

    it('sollte die Fallback-Kategorien nutzen, wenn der LocalStorage leer ist', async () => {
      connectionStatusSignal.set('OFFLINE');
      const fallbacks = ['Standard_A', 'Standard_B'];
      
      const result = await service.getAvailableCategories('u1', 'todo', fallbacks);
      expect(result).toEqual(fallbacks);
    });
  });
});