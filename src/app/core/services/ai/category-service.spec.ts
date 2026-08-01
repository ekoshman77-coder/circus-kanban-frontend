import { TestBed } from '@angular/core/testing';
import { CategoryService } from './category-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { ConnectionService } from '../connection/connection-service';
import { Todo } from '../../models/todo';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

describe('CategoryService', () => {
  let service: CategoryService;
  
  // Mocks
  let mockTodoRepository: any;
  let mockConnectionService: any;
  let connectionStatusSignal: any;

  // Testdaten
  const testTodos: Todo[] = [
    { id: '1', task: 'Milch einkaufen', category: 'Einkauf', done: false, projectId: 'p1', userId: 'u1' } as any,
    { id: '2', task: 'Code refactoring machen', category: 'Arbeit', done: false, projectId: 'p1', userId: 'u1' } as any,
    { id: '3', task: 'Brot einkaufen', category: 'Einkauf', done: true, projectId: 'p1', userId: 'u1' } as any
  ];

  beforeEach(() => {
    // Da status ein Signal im ConnectionService ist, simulieren wir ein echtes Signal
    connectionStatusSignal = signal<'ONLINE' | 'OFFLINE'>('ONLINE');

    mockConnectionService = {
      status: connectionStatusSignal
    };

    mockTodoRepository = {
      getServerCategories: vi.fn().mockReturnValue(of(['Arbeit', 'Einkauf', 'Privat'])),
      getAiCategorySuggestion: vi.fn().mockReturnValue(of({ suggestedCategory: 'Einkauf' }))
    };

    TestBed.configureTestingModule({
      providers: [
        CategoryService,
        { provide: TodoRepository, useValue: mockTodoRepository },
        { provide: ConnectionService, useValue: mockConnectionService }
      ]
    });

    service = TestBed.inject(CategoryService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllCategories', () => {
    it('sollte im ONLINE-Modus Kategorien vom Server laden', async () => {
      connectionStatusSignal.set('ONLINE');
      const result = await service.getAllCategories('u1', testTodos);
      
      expect(result).toEqual(['Arbeit', 'Einkauf', 'Privat']);
      expect(mockTodoRepository.getServerCategories).toHaveBeenCalledWith('u1');
    });

    it('sollte im OFFLINE-Modus Kategorien lokal aus den Todos extrahieren', async () => {
      connectionStatusSignal.set('OFFLINE');
      const result = await service.getAllCategories('u1', testTodos);
      
      // Sollte einzigartig und alphabetisch sortiert sein (inkl. 'Allgemein')
      expect(result).toEqual(['Allgemein', 'Arbeit', 'Einkauf']);
      expect(mockTodoRepository.getServerCategories).not.toHaveBeenCalled();
    });

    it('sollte bei einem Server-Fehler im ONLINE-Modus auf den Offline-Extraktor zurückfallen', async () => {
      connectionStatusSignal.set('ONLINE');
      mockTodoRepository.getServerCategories.mockReturnValue(throwError(() => new Error('Server offline')));

      const result = await service.getAllCategories('u1', testTodos);
      expect(result).toEqual(['Allgemein', 'Arbeit', 'Einkauf']);
    });
  });

  describe('predictCategory', () => {
    it('sollte sofort "Allgemein" zurückgeben, wenn der Text zu kurz ist', async () => {
      const result = await service.predictCategory('ab', 'u1', testTodos);
      expect(result).toBe('Allgemein');
    });

    it('sollte im ONLINE-Modus die KI-Vorhersage vom Server nutzen', async () => {
      connectionStatusSignal.set('ONLINE');
      const result = await service.predictCategory('Milch kaufen', 'u1', testTodos);
      
      expect(result).toBe('Einkauf');
      expect(mockTodoRepository.getAiCategorySuggestion).toHaveBeenCalledWith('Milch kaufen', 'u1');
    });

    it('sollte im OFFLINE-Modus den Offline-Detektiv nutzen', async () => {
      connectionStatusSignal.set('OFFLINE');
      // "refactoring" matcht mit "Code refactoring machen" -> Kategorie: "Arbeit"
      const result = await service.predictCategory('refactoring erledigen', 'u1', testTodos);
      
      expect(result).toBe('Arbeit');
      expect(mockTodoRepository.getAiCategorySuggestion).not.toHaveBeenCalled();
    });

    it('sollte bei Serverfehler im ONLINE-Modus den Offline-Detektiv als Fallback nutzen', async () => {
      connectionStatusSignal.set('ONLINE');
      mockTodoRepository.getAiCategorySuggestion.mockReturnValue(throwError(() => new Error('KI nicht erreichbar')));

      // "brot" matcht mit "Brot einkaufen" -> Kategorie: "Einkauf"
      const result = await service.predictCategory('Frisches brot holen', 'u1', testTodos);
      expect(result).toBe('Einkauf');
    });
  });
});