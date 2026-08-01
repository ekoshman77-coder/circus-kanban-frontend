import { flushMicrotasks, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TodoService } from './todo-service';
import { TodoDataManagerService } from './todo-data-manager-service';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { TodoQueryService } from './todo-query-service';
import { NotificationService } from '../notification/notification-service';
import { Todo } from '../../models/todo';
import { of } from 'rxjs';

describe('TodoService - Board Filter Tests (Vitest)', () => {
    let service: TodoService;

    // Unsere steuerbaren Signals & Mocks
    let allTodosPoolMock = signal<Todo[]>([]);
    let currentUserIdMock = signal<string | null>('user-123');

    let dataManagerMock: any;
    let userServiceMock: any;
    let loggerMock: any;
    let repositoryMock: any;
    let queryServiceMock: any;
    let notificationMock: any;

    beforeEach(() => {
        // Vor jedem Test Mocks & Signals sauber auf Startzustand setzen
        allTodosPoolMock.set([]);
        currentUserIdMock.set('user-123');

        dataManagerMock = {
            allTodosPool: allTodosPoolMock,
            loadTodos: vi.fn(() => of(allTodosPoolMock())),
            syncCompleted: vi.fn().mockReturnValue(null),
            clearSyncResult: vi.fn()
        };

        userServiceMock = {
            getCurrentUserId: vi.fn(() => currentUserIdMock())
        };

        loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        repositoryMock = { getAiCategorySuggestion: vi.fn(), getServerCategories: vi.fn() };
        queryServiceMock = { hasPermissionForMilestone: vi.fn().mockReturnValue(true) };
        notificationMock = { showNotification: vi.fn() };

        TestBed.configureTestingModule({
            providers: [
                TodoService,
                { provide: TodoDataManagerService, useValue: dataManagerMock },
                { provide: UserService, useValue: userServiceMock },
                { provide: LoggerService, useValue: loggerMock },
                { provide: TodoRepository, useValue: repositoryMock },
                { provide: TodoQueryService, useValue: queryServiceMock },
                { provide: NotificationService, useValue: notificationMock }
            ]
        });

        // 🎯 HIER WURDE "service = TestBed.inject(TodoService)" ENTFERNT!
    });

    describe('signal logik', () => {
        let privateTodo: Todo;
        let teamTodo: Todo;

        beforeEach(() => {
            privateTodo = new Todo({
                task: "private todo",
                userId: currentUserIdMock() ?? ""
            });

            teamTodo = new Todo({
                task: "team todo",
                milestoneId: "milestone123"
            });

            // 1. Erst Daten setzen!
            allTodosPoolMock.set([teamTodo, privateTodo]);
            // 2. Dann erst den Service initialisieren, damit der Constructor die Daten sieht!
            service = TestBed.inject(TodoService);
        });

        it('sollte in privateTodos nur Aufgaben ohne Meilenstein auflisten', () => {
            const todos = service.privateTodos();
            expect(todos).toEqual([privateTodo]);
        });

        it('sollte in teamTodos nur Aufgaben mit Meilenstein auflisten', () => {
            const todos = service.teamTodos();
            expect(todos).toEqual([teamTodo]);
        });

        it('sollte in focusedTodos private Aufgaben und Aufgaben mit Meilenstein assigned to user auflisten', () => {
            const teamTodoAssigned = new Todo({
                task: "assigned todo",
                milestoneId: "milesone123",
                userId: "other",
                assignedUserId: currentUserIdMock(),
            });
            allTodosPoolMock.update(value => [...value, teamTodoAssigned]);
            const todos = service.focusedTodos();
            expect(todos.length).toEqual(2);
            expect(todos).toContainEqual(teamTodoAssigned);
            expect(todos).toContainEqual(privateTodo);
        });
    });

    describe('Synchrone Hilfsmethoden', () => {
        it('sollte die Fibonacci-Sequenz bis zum Limit korrekt generieren', () => {
            service = TestBed.inject(TodoService); // Service hier erstellen
            const seq = service.initFibonacciSequence(10);
            expect(seq).toEqual([1, 2, 3, 5, 8]);
        });

        it('sollte ein Todo anhand der ID aus todosSignal finden', () => {
            const wrongTodo = new Todo({ task: "wrong", id: "todo-wrong", userId: currentUserIdMock() ?? "" });
            const testTodo = new Todo({ task: "test", id: "testid", userId: currentUserIdMock() ?? "" });

            allTodosPoolMock.set([testTodo, wrongTodo]);
            service = TestBed.inject(TodoService); // Erst nach dem Set befüllen!

            const todo = service.getTodoById("testid");
            expect(todo).toStrictEqual(testTodo);
        });
    });

    describe('Asynchrone Mutationen (mit Fake Timers)', () => {
        // 💡 Wir entfernen vi.useFakeTimers aus dem beforeEach!
        // So läuft der Constructor des Services in der "echten" Zeit an.
        beforeEach(() => {
            // leer lassen!
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('sollte ein Todo erfolgreich aktualisieren und den Pool updaten', async () => {
            const initialTodo = new Todo({ task: 'alte Aufgabe', id: 'todo-1' });
            const updatedTodo = new Todo({ task: 'neue Aufgabe', id: 'todo-1' });

            // 1. Daten & Mocks vorbereiten
            allTodosPoolMock.set([initialTodo]);
            dataManagerMock.updateTodo = vi.fn().mockReturnValue(of([updatedTodo]));

            // 2. Service wird in "Echtzeit" geboren. Die Effekte laufen einmal ruhig an.
            service = TestBed.inject(TodoService);

            // 3. JETZT ERST aktivieren wir die Zeitmaschine für die updateTodo-Methode!
            vi.useFakeTimers();

            // 4. Methode ausführen (isDragAndDrop = false -> 300ms Delay!)
            service.updateTodo(updatedTodo, false);

            // Sofortige Prüfung (Timer läuft im Hintergrund)
            expect(allTodosPoolMock()).toContainEqual(initialTodo);

            // 🕒 Zeitmaschine 300ms vorspulen
            vi.advanceTimersByTime(300);

            // 🧼 Microtasks von RxJS einmal durchrutschen lassen
            await Promise.resolve();

            // 5. Überprüfung
            expect(dataManagerMock.updateTodo).toHaveBeenCalled();
            expect(allTodosPoolMock().length).toBe(1);
            expect(allTodosPoolMock()[0].id).toBe('todo-1');
            expect(allTodosPoolMock()[0].task).toBe('neue Aufgabe');
        });
    });

});