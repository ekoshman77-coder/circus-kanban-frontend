import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { Todo } from '../../models/todo';
import { catchError, map, Observable, of } from 'rxjs';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger-service';
import { ErrorCode } from '../../enums/error-enum';
import { GamificationResult } from '../../models/gamification';
import { TodoDataManagerService } from '../todo-data-manager-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { TodoQueryService } from '../todo-query-service'; // 💡 NEU: Der Kreis-Sprenger importiert!

export enum Filter {
  ALL = 'all',
  OPEN = 'open',
  COMPLETED = 'completed',
  DUE_TODAY = 'due_today',
  OVERDUE = 'overdue'
}

export enum EffortType {
  COMPLETED = 'completed',
  OPEN = 'open'
}

export class Effort {
  constructor(public effort: number, public effortType: EffortType) { }
}

export class Statistics {
  total = 0;
  open = 0;
  completed = 0;
  overdue = 0;
  dueToday = 0;
}

@Injectable({
  providedIn: 'root',
})
export class TodoService {
  private dataManager = inject(TodoDataManagerService);
  private userService = inject(UserService);
  private loggerService = inject(LoggerService);
  private todoRepository = inject(TodoRepository);
  private todoQueryService = inject(TodoQueryService); // 💡 NEU: Ersetzt den direkten TeamService-Check für Meilensteine

  // --- REAKTIVER STATE (SIGNALS & GLOBAL POOL) ---
  // 🌍 DER TRICK: Verweist jetzt direkt auf das Signal im DataManager unten!
  private allTodosPool = this.dataManager.allTodosPool;

  // 👤 Die Brücke für die UI: Filtert den Pool vollautomatisch auf deine Aufgaben!
  public todosSignal = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];
    return this.allTodosPool().filter(t => t.userId === currentUserId);
  });

  public filterSignal = signal<Filter>(Filter.ALL);
  public searchQuerySignal = signal<string>('');
  public gamificationState = signal<GamificationResult | null>(null);

  public fibonacciSequence: number[];

  // --- UNDO CONTROLS ---
  private isUndoActive = signal<boolean>(false);
  private undoTimeoutRef: any = null;
  private deletedTodosBackup: Todo[] = [];

  public showUndoToast = signal<boolean>(false);
  public lastDeletedTaskName = signal<string>('');

  public globalError = signal<string | null>(null);
  public latestGamificationResult = signal<GamificationResult | null>(null);

  // --- COMPUTED STATES ---
  public openTodosOnly = computed(() => {
    return this.todosSignal().filter(t => !t.done);
  });

  public allTodos = computed(() => {
    return [...this.todosSignal()];
  });

  constructor() {
    this.fibonacciSequence = this.initFibonacciSequence(40);

    effect(() => {
      const userId = this.userService.getCurrentUserId();

      if (userId) { // Einfach nur prüfen, ob überhaupt ein User eingeloggt ist!
        this.loggerService.info("controller", `🚀 [TodoService] User "${userId}" erkannt. Lade Aufgaben...`);
        this.loadTodosFromBackend(userId);
      } else {
        this.loggerService.info("controller", `⏳ [TodoService] Warte auf Anmeldung...`);
        this.updateTodosState([]);
      }
    });

    effect(() => {
      const syncResult = this.dataManager.syncCompleted();
      if (syncResult !== null) {
        this.allTodosPool.set(syncResult.liste);
        this.gamificationState.set(syncResult.gamificationResult);
        if (syncResult.gamificationResult.levelUp) {
          alert(`🎉 LEVEL UP! Du bist jetzt Level ${syncResult.gamificationResult.currentLevel}!`);
        }
        untracked(() => {
          this.dataManager.clearSyncResult();
        });
      }
    });
  }

  private loadTodosFromBackend(userId: string) {
    this.dataManager.loadTodos(userId).subscribe({
      next: (todosFromDB) => {
        this.updateTodosState(todosFromDB);
      },
      error: (err) => {
        this.handleBackendError(err, false);
      }
    });
  }

  /**
   * 🧠 Holt KI-Quick-Vorschläge (delegiert komplett an den DataManager)
   */
  public getQuickPredictions(modus: 'PAUSE' | 'ACTIVE'): Observable<string[]> {
    return this.dataManager.getQuickPredictions(modus);
  }

  initFibonacciSequence(limit: number): number[] {
    const sequence = [1, 2];
    while (true) {
      const next = sequence[sequence.length - 1] + sequence[sequence.length - 2];
      if (next > limit) break;
      sequence.push(next);
    }
    return sequence;
  }

  private updateTodosState(newTodos: Todo[]) {
    this.allTodosPool.set(newTodos.map(todo => new Todo(todo)));
  }

  // --- STATE MUTATIONS ---

  public createAndAddTodo(input: {
    task: string,
    description: string | null,
    effort: number,
    dueDate: number,
    category?: string,
    milestoneId?: string | null,
    isStarted: false
  }) {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    const withUser = { ...input, userId: userId }
    const newTodo = new Todo(withUser);
    this.addDoneTodo(newTodo);
  }

  public addDoneTodo(todo: Todo) {
    this.dataManager.createTodo(todo, this.allTodosPool()).subscribe({
      next: (newListe) => {
        this.updateTodosState(newListe);
      },
      error: (err) => this.handleBackendError(err, false)
    });
  }

  public updateTodo(updatedTodo: Todo, isDragAndDrop: boolean = false): void {
    console.log(`TodoService:: updateTodo (DragAndDrop: ${isDragAndDrop})`, updatedTodo);

    // 💡 NEU: Nutzen jetzt den todoQueryService statt teamService
    if (updatedTodo.milestoneId && !this.todoQueryService.hasPermissionForMilestone(updatedTodo.milestoneId, 'TODO_EDIT')) {
      this.loggerService.warn("todoService", `Abbruch updateTodo: Keine Berechtigung für Meilenstein ${updatedTodo.milestoneId}`);
      return;
    }

    if (isDragAndDrop) {
      this.allTodosPool.update(todos =>
        todos.map(t => t.id === updatedTodo.id ? updatedTodo : t)
      );
    }

    const delay = isDragAndDrop ? 0 : 300;

    setTimeout(() => {
      this.dataManager.updateTodo(updatedTodo, this.allTodosPool()).subscribe({
        next: (neueListe) => {
          this.updateTodosState(neueListe);
        },
        error: (err) => {
          this.handleBackendError(err, false);
        }
      });
    }, delay);
  }

  public updateTodoEffort(todoId: string, newEffort: number) {
    const todoToUpdate = this.allTodosPool().find(t => t.id === todoId);
    if (!todoToUpdate || todoToUpdate.done) return;

    // 💡 NEU: Nutzen jetzt den todoQueryService statt teamService
    if (todoToUpdate.milestoneId && !this.todoQueryService.hasPermissionForMilestone(todoToUpdate.milestoneId, 'TODO_EDIT')) {
      this.loggerService.warn("todoService", `Abbruch updateTodo: Keine Berechtigung für Meilenstein ${todoToUpdate.milestoneId}`);
      return;
    }

    todoToUpdate.effort = newEffort;

    setTimeout(() => {
      this.dataManager.updateTodo(todoToUpdate, this.allTodosPool()).subscribe({
        next: (neueListe) => {
          this.updateTodosState(neueListe);
        },
        error: (err) => this.handleBackendError(err, false)
      });
    }, 300);
  }

  public toggleComplete(todoId: string, usedEffort: number): void {
    this.loggerService.info("todoService", `Starting toggleComplete for ID: ${todoId} with effort: ${usedEffort}`);
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    const currentTodo = this.allTodosPool().find(t => t.id === todoId);
    if (!currentTodo) {
      this.loggerService.warn("todoService", `Todo with ID ${todoId} not found in state.`);
      return;
    }

    // 💡 NEU: Nutzen jetzt den todoQueryService statt teamService
    if (currentTodo.milestoneId && !this.todoQueryService.hasPermissionForMilestone(currentTodo.milestoneId, 'TODO_CHECK')) {
      this.loggerService.warn("todoService", `Abbruch toggleComplete: Keine Berechtigung.`);
      return;
    }

    const updatedTodo = Todo.fromTodo(currentTodo);
    updatedTodo.done = !updatedTodo.done;

    if (updatedTodo.done) {
      updatedTodo.completedAt = Date.now();
      updatedTodo.usedEffort = usedEffort;
    } else {
      updatedTodo.completedAt = null;
    }

    setTimeout(() => {
      const optimisticList = this.allTodosPool().map(t => t.id === todoId ? updatedTodo : t);
      this.allTodosPool.set(optimisticList);

      this.dataManager.updateTodo(updatedTodo, optimisticList).subscribe({
        next: (finalList) => {
          this.updateTodosState(finalList);
          this.loggerService.info("todoService", "Full todo update successfully processed.");
        },
        error: (err) => {
          this.loggerService.warn('TODO_SERVICE', 'Update failed, triggering rollback...', err);
          const userId = this.userService.getCurrentUserId()
          if (userId) {
            this.loadTodosFromBackend(userId);
          }
        }
      });
    }, 500);
  }

  public addPoint(id: string) {
    const todoToUpdate = this.allTodosPool().find(t => t.id === id);
    if (!todoToUpdate) return;

    todoToUpdate.usedEffort++;

    setTimeout(() => {
      this.dataManager.updateTodo(todoToUpdate, this.allTodosPool()).subscribe({
        next: (neueListe) => {
          this.updateTodosState(neueListe);
        },
        error: (err) => this.handleBackendError(err, false)
      });
    }, 500);
  }

  public createTodo(todo: Todo): Todo {
    return Todo.fromTodo(todo);
  }

  public deleteTodo(id: string): void {
    const todoToDelete = this.allTodosPool().find(t => t.id === id);
    if (!todoToDelete) return;

    this.lastDeletedTaskName.set(todoToDelete.task);
    this.showUndoToast.set(true);

    this.allTodosPool.set(this.allTodosPool().filter(t => t.id !== id));

    this.dataManager.deleteTodosBulk([todoToDelete], this.allTodosPool()).subscribe({
      next: (updatedList) => {
        this.allTodosPool.set(updatedList);
      },
      error: (err) => {
        this.loggerService.error("TodoService", "Fehler beim Löschen des To-Dos", err);
        this.globalError.set("Aufgabe konnte nicht gelöscht werden.");
      }
    });
  }

  public undoDelete() {
    this.isUndoActive.set(true);
    this.showUndoToast.set(false);

    if (this.undoTimeoutRef !== null) {
      clearTimeout(this.undoTimeoutRef);
      this.undoTimeoutRef = null;
    }

    if (this.deletedTodosBackup.length > 0) {
      this.allTodosPool.set([...this.deletedTodosBackup, ...this.allTodosPool()]);
      this.deletedTodosBackup = [];
    }
  }

  public getTodosForMilestone(id: string | null): Todo[] {
    if (!id) {
      return [];
    }
    return this.filteredTodos().filter(t => t.milestoneId === id)
  }

  public clearCompletedTodos(): void {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const completedPrivateTodos = this.allTodosPool().filter(
      todo => todo.done && todo.userId === currentUser.id && !todo.milestoneId
    );

    if (completedPrivateTodos.length === 0) return;

    this.loggerService.info("TodoService", `Bulk-Löschen von ${completedPrivateTodos.length} erledigten privaten Aufgaben.`);

    this.dataManager.deleteTodosBulk(completedPrivateTodos, this.allTodosPool()).subscribe({
      next: (updatedList) => {
        this.allTodosPool.set(updatedList);
      },
      error: (err) => {
        this.loggerService.error("TodoService", "Fehler beim Bulk-Löschen der erledigten privaten To-Dos", err);
        this.globalError.set("Erledigte private Aufgaben konnten nicht gelöscht werden.");
      }
    });
  }

  public clearAllTodos(): void {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const allUserPrivateTodos = this.allTodosPool().filter(
      todo => todo.userId === currentUser.id && !todo.milestoneId
    );

    if (allUserPrivateTodos.length === 0) return;

    this.loggerService.info("TodoService", `Bulk-Löschen von all den ${allUserPrivateTodos.length} privaten Aufgaben.`);

    this.dataManager.deleteTodosBulk(allUserPrivateTodos, this.allTodosPool()).subscribe({
      next: (updatedList) => {
        this.allTodosPool.set(updatedList);
      },
      error: (err) => {
        this.loggerService.error("TodoService", "Fehler beim Bulk-Löschen aller privaten To-Dos", err);
        this.globalError.set("Private Aufgaben konnten nicht gelöscht werden.");
      }
    });
  }

  public clearGlobalError() {
    this.globalError.set(null);
  }

  private handleBackendError(err: any, isDelayedAction: boolean): void {
    this.loggerService.error('STATE_CHANGE', 'Mutation fehlgeschlagen', err);

    const errorCode: ErrorCode = err.error?.errorCode;

    if (errorCode === ErrorCode.UserNotFound) {
      console.warn('Zentraler Handler: User in DB gelöscht. Setze nur State zurück!');
      this.userService.logout();
      return;
    }

    if (errorCode === ErrorCode.TodoNotFound) {
      alert('Huch! Diese Aufgabe existiert nicht mehr auf dem Server. 📋');
      const userId = this.userService.getCurrentUserId();
      if (userId) this.loadTodosFromBackend(userId);
      return;
    }

    this.globalError.set('Aktion fehlgeschlagen. Verbindung zum Server verloren.');

    if (isDelayedAction) {
      if (this.deletedTodosBackup.length > 0) {
        this.allTodosPool.set([...this.deletedTodosBackup, ...this.allTodosPool()]);
        this.deletedTodosBackup = [];
      }
      this.isUndoActive.set(false);
      this.undoTimeoutRef = null;
    }
  }

  // --- COMPUTED STATES ---
  public isListEmpty = computed(() => this.todosSignal().length === 0);

  public totalOpenEffort = computed(() => {
    const todos = this.todosSignal().filter(t => !t.done);
    return todos.reduce((prev, t) => prev + (t.effort || 0), 0);
  });

  public filteredTodos = computed(() => {
    const todos = this.todosSignal();
    const filter = this.filterSignal();
    const searchQuery = this.searchQuerySignal();
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayEnd = new Date().setHours(23, 59, 59, 999);
    let result: Todo[] = [];

    switch (filter) {
      case Filter.OPEN:
        result = todos.filter(t => !t.done).sort((a, b) => a.dueDate - b.dueDate);
        break;
      case Filter.COMPLETED:
        result = todos.filter(t => t.done).sort((a, b) => a.completedAt! - b.completedAt!);
        break;
      case Filter.DUE_TODAY:
        result = todos.filter(t => !t.done && t.dueDate >= todayStart && t.dueDate <= todayEnd)
          .sort((a, b) => a.dueDate - b.dueDate);
        break;
      case Filter.OVERDUE:
        result = todos.filter(t => !t.done && t.dueDate < now)
          .sort((a, b) => a.dueDate - b.dueDate);
        break;
      default:
        result = [...todos].sort((a, b) => {
          const getWeight = (t: Todo) => {
            return t.done ? 1 : 0;
          };
          const weightA = getWeight(a);
          const weightB = getWeight(b);
          if (weightA !== weightB) return weightA - weightB;

          if (!a.done) {
            if (a.dueDate !== b.dueDate) {
              return a.dueDate - b.dueDate;
            }
            return (a.createdAt || 0) - (b.createdAt || 0);
          }

          return Number(a.createdAt) - Number(b.createdAt);
        });
    }

    if (searchQuery) {
      result = result.filter(t =>
        t.task.toLowerCase().includes(searchQuery) ||
        t.description?.toLowerCase().includes(searchQuery)
      );
    }

    return result;
  });

  public statistics = computed(() => {
    const statistics = new Statistics();
    const todos = this.todosSignal();
    statistics.total = todos.length;

    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayEnd = new Date().setHours(23, 59, 59, 999);

    todos.forEach(todo => {
      if (todo.done) {
        statistics.completed++;
      } else {
        statistics.open++;
        if (todo.dueDate < now) statistics.overdue++;
        if (todo.dueDate >= todayStart && todo.dueDate <= todayEnd) statistics.dueToday++;
      }
    });
    return statistics;
  });

  public totalEffort = computed(() => {
    const tasks = this.filteredTodos();
    const filter = this.filterSignal();
    const effortType = filter === Filter.COMPLETED ? EffortType.COMPLETED : EffortType.OPEN;

    if (tasks.length === 0) {
      return new Effort(0, effortType);
    }

    const list = effortType === EffortType.COMPLETED
      ? tasks.filter(t => t.done)
      : tasks.filter(t => !t.done);

    const total = list.reduce((sum, todo) => sum + todo.effort, 0);
    return new Effort(total, effortType);
  });

  public getAiCategorySuggestion(text: string, userId: string): Observable<{ suggestedCategory: string }> {
    return this.todoRepository.getAiCategorySuggestion(text, userId);
  }

  public getServerCategories(userId: string): Observable<string[]> {
    return this.todoRepository.getServerCategories(userId);
  }
}