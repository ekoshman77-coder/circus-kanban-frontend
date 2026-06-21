import { TestBed } from '@angular/core/testing';
import { ProjectService } from './project-service';
import { ProjectDataManagerService } from './project-data-mananger-service';
import { UserService } from './user/user-service';
import { TodoService } from './todo/todo-service';
import { TodoViewModel } from '../viewmodel/todo-view-model';
import { Todo } from '../models/todo';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { NoteService } from './note-service';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Project } from '../models/project';

describe('ProjectService', () => {
  let service: ProjectService;

  let dataManagerMock: any;
  let noteServiceMock: any;
  let userServiceMock: any;
  // 1. VORBEREITUNG (Arrange)
  // Weil der Service im Constructor den UserService aufruft, müssen wir dem System
  // "vorgaukeln" (mocken), dass ein Benutzer angemeldet ist, sonst stürzt der Test ab!
beforeEach(() => {
    // 1. Definition der Mocks mit Vitest-Spionen
    dataManagerMock = {
      getProjects: vi.fn().mockReturnValue(of([])),
      createProject: vi.fn(),
      updateProject: vi.fn()
    };

    noteServiceMock = {
      updateNoteStatus: vi.fn()
    };

    userServiceMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'user-123', name: 'Werner' })
    };

    TestBed.configureTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectDataManagerService, useValue: dataManagerMock },
        { provide: NoteService, useValue: noteServiceMock },
        { provide: UserService, useValue: userServiceMock }
      ]
    });

    service = TestBed.inject(ProjectService);
  });
  // 🧪 TEST 1: Wir testen die Status-Logik für "Erledigt"
  it('should return "Erledigt" if ALL todos are completed', () => {
    // [Arrange] Wir erstellen zwei To-Dos, die BEIDE erledigt (done: true) sind
    const todo1 = new TodoViewModel(new Todo({ id: 't1', task: 'Test 1', done: true, effort: 3 }), false);
    const todo2 = new TodoViewModel(new Todo({ id: 't2', task: 'Test 2', done: true, effort: 2 }), false);
    const testTodos = [todo1, todo2];

    // [Act] Wir jagen die Testdaten durch die Methode des Services
    const ergebnisStatus = service.calculateMilestoneStatus(testTodos);

    // [Assert] Wir erwarten knallhart, dass das Ergebnis den String 'Erledigt' liefert!
    expect(ergebnisStatus).toBe('Erledigt');
  });

  // 🧪 TEST 2: Wir testen die Status-Logik für "In Arbeit"
  it('should return "In Arbeit" if at least one todo is done but not all', () => {
    // [Arrange] Ein To-Do ist fertig (true), das andere nicht (false)
    const todo1 = new TodoViewModel(new Todo({ id: 't1', task: 'Fertig', done: true, effort: 3 }), false);
    const todo2 = new TodoViewModel(new Todo({ id: 't2', task: 'Offen', done: false, effort: 2 }), false);
    const testTodos = [todo1, todo2];

    // [Act] Methode ausführen
    const ergebnisStatus = service.calculateMilestoneStatus(testTodos);

    // [Assert] Erwartung überprüfen
    expect(ergebnisStatus).toBe('In Arbeit');
  });

  // 🧪 TEST 3: Wir testen die Prozentrechnung (Fortschritt)
  it('should correctly calculate progress percentage based on effort points', () => {
    // [Arrange] 
    // Todo 1 hat einen Aufwand von 3 Punkten und ist ERLEDIGT (done: true) -> 3 Punkte geschafft
    // Todo 2 hat einen Aufwand von 1 Punkt und ist OFFEN (done: false)
    // Gesamtaufwand = 4 Punkte. Davon 3 geschafft = 75% Fortschritt!
    const todo1 = new TodoViewModel(new Todo({ id: 't1', task: 'Schwer', done: true, effort: 3 }), false);
    const todo2 = new TodoViewModel(new Todo({ id: 't2', task: 'Leicht', done: false, effort: 1 }), false);
    const testTodos = [todo1, todo2];

    // [Act] Fortschritts-Methode aufrufen
    const prozentErgebnis = service.calculateMilestoneProgress(testTodos);

    // [Assert] Vitest prüft, ob mathematisch exakt 75 herauskommt
    expect(prozentErgebnis).toBe(75);
  });

  // 🎯 TEST 1: Prüft das erfolgreiche Sperren via tap()
  it('sollte nach erfolgreichem Erstellen des Projekts den Note-Status auf isInCalculation=true setzen', () => {
    return new Promise<void>((resolve, reject) => {
      // Arrange
      const dummyProject = new Project({
        id: 'proj-999',
        ideaId: 'note-456', // 👈 Diese Idee muss gesperrt werden!
        title: 'Angular lernen',
        area: 'Frontend'
      });

      // In Vitest nutzen wir .mockReturnValue() für das Mocking von Ergebnissen
      dataManagerMock.createProject.mockReturnValue(of(dummyProject));

      // Act
      service.saveCalculatedProject(dummyProject).subscribe({
        next: (savedId) => {
          // Assert
          expect(savedId).toBe('proj-999');
          
          // 🔥 DER ENTSCHEIDENDE CHECK: Hat das tap() gefeuert?
          expect(noteServiceMock.updateNoteStatus).toHaveBeenCalledWith('note-456', true);
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  });

  // 🛡️ TEST 2: Sicherheits-Check bei Server-Fehlern
it('sollte den Note-Status NICHT ändern, wenn der Server-Call fehlschlägt', async () => {
    // Arrange
    const dummyProject = new Project({
      id: 'proj-999',
      ideaId: 'note-456',
      title: 'Abstürzendes Projekt',
      area: 'Backend'
    });

    // Fehler simulieren
    dataManagerMock.createProject.mockReturnValue(throwError(() => new Error('Server kaputt!')));

    // Act & Assert
    // Wir erwarten, dass das Promise wegen des throwError() fehlschlägt
    await expect(
      firstValueFrom(service.saveCalculatedProject(dummyProject))
    ).rejects.toThrow('Server kaputt!');

    // 🔥 DER ENTSCHEIDENDE CHECK: Trotz des Absturzes darf das Flag auf keinen Fall geändert werden!
    expect(noteServiceMock.updateNoteStatus).not.toHaveBeenCalled();
  });
});