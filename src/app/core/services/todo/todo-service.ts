import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { Todo } from '../../models/todo';
import { Observable } from 'rxjs';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger-service';
import { ErrorCode } from '../../enums/error-enum';
import { GamificationResult } from '../../models/gamification';
import { TodoDataManagerService } from '../todo-data-manager-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { ProjectService } from '../project-service';

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
  private todoRepository = inject(TodoRepository)

  // --- REAKTIVER STATE (SIGNALS - Exakt wie im Original!) ---
  public todosSignal = signal<Todo[]>([]);
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

  // --- COMPUTED STATES (Exakt wie im Original!) ---
  public openTodosOnly = computed(() => {
    return this.todosSignal().filter(t => !t.done);
  });

  public allTodos = computed(() => {
    return [...this.todosSignal()];
  });

  constructor() {
    this.fibonacciSequence = this.initFibonacciSequence(40);

    // 🛡️ DER SCHUTZSCHILD: Läuft für bestehende User beim F5-Laden, 
    // wartet aber bei neuen Usern, bis die Registrierung fertig ist!
    effect(() => {
      const userId = this.userService.getCurrentUserId();

      // Regex für eine echte 36-stellige UUID (z.B. ac8d71e0-0dda...)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUuid = userId ? uuidRegex.test(userId) : false;

      if (isValidUuid) {
        this.loggerService.info("controller", `🚀 [TodoService] Echte User-UUID erkannt ("${userId}"). Lade Aufgaben...`);
        this.loadTodosFromBackend(userId!);
      } else {
        // Wenn die ID leer ist oder beim Registrieren gerade erst entsteht, leeren wir nur das Board im RAM
        this.loggerService.info("controller", `⏳ [TodoService] Warte auf gültige Anmeldung...`);
        this.updateTodosState([]);
      }
    });

    // Der zweite Effekt für das Sync-Ergebnis bleibt genau so wie er war:
    effect(() => {
      const syncResult = this.dataManager.syncCompleted();
      if (syncResult !== null) {
        this.todosSignal.set(syncResult.liste);
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

  initFibonacciSequence(limit: number): number[] {
    const sequence = [1, 2]; //
    while (true) {
      const next = sequence[sequence.length - 1] + sequence[sequence.length - 2]; //
      if (next > limit) break; //
      sequence.push(next); //
    }
    return sequence; //
  }

  private updateTodosState(newTodos: Todo[]) {
    this.todosSignal.set(newTodos);
  }

  // --- STATE MUTATIONS ---

  public createAndAddTodo(input:{
    task: string, 
    description: string | null, 
    effort: number, 
    dueDate: number, 
    category?: string, 
    milestoneId?: string | null,
    isStarted: false
  }) {
    const userId = this.userService.getCurrentUserId(); //
    if (!userId) return; //

    const withUser = {...input, userId: userId}
    const newTodo = new Todo(withUser); //
    this.addDoneTodo(newTodo);
  }

  public addDoneTodo(todo: Todo) {
    this.dataManager.createTodo(todo, this.todosSignal()).subscribe({
      next: (neueListe) => {
        this.updateTodosState(neueListe);
      },
      error: (err) => this.handleBackendError(err, false)
    });
  }

public updateTodo(updatedTodo: Todo, isDragAndDrop: boolean = false): void {
    console.log(`TodoService:: updateTodo (DragAndDrop: ${isDragAndDrop})`, updatedTodo);

    // 🚀 1. Optimistisches UI: Bei Drag & Drop das Signal SOFORT anpassen,
    // damit das Timing-Loch auf den Boards augenblicklich gestopft wird!
    if (isDragAndDrop) {
      this.todosSignal.update(todos => 
        todos.map(t => t.id === updatedTodo.id ? updatedTodo : t)
      );
    }

    // ⏱️ 2. Deine geniale Idee: Die Verzögerung dynamisch bestimmen!
    const delay = isDragAndDrop ? 0 : 300;

    // 🔄 3. Nur noch EIN EINZIGER asynchroner Block dank deiner Weiche!
    setTimeout(() => {
      this.dataManager.updateTodo(updatedTodo, this.todosSignal(), updatedTodo.userId).subscribe({
        next: (neueListe) => {
          this.updateTodosState(neueListe);
        },
        error: (err) => {
          this.handleBackendError(err, false);
          // Falls beim schnellen Drag & Drop ein Serverfehler auftritt, 
          // holen wir den alten Zustand zurück
          if (isDragAndDrop) {
            this.handleBackendError(err, false); 
          }
        }
      });
    }, delay); // <-- Hier greift die dynamische Zeit!
  }

  public updateTodoEffort(todoId: string, newEffort: number) {
    const todoToUpdate = this.todosSignal().find(t => t.id === todoId); //
    if (!todoToUpdate || todoToUpdate.done) return; //

    todoToUpdate.effort = newEffort; //

    setTimeout(() => {
      this.dataManager.updateTodo(todoToUpdate, this.todosSignal(), todoToUpdate.userId).subscribe({
        next: (neueListe) => {
          this.updateTodosState(neueListe);
        },
        error: (err) => this.handleBackendError(err, false)
      });
    }, 300); //
  }

/**
   * 🌟 Controls the completion toggle and passes the updated object down the pipeline
   */
  public toggleComplete(todoId: string, usedEffort: number): void {
    this.loggerService.info("todoService", `Starting toggleComplete for ID: ${todoId} with effort: ${usedEffort}`);
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    // 1. Find the current todo in our state
    const currentTodo = this.todosSignal().find(t => t.id === todoId);
    if (!currentTodo) {
      this.loggerService.warn("todoService", `Todo with ID ${todoId} not found in state.`);
      return;
    }

    // 2. Control data modification INSIDE the service (Encapsulation!)
    // We clone the todo so we don't mutate the state directly
    const updatedTodo = Todo.fromTodo(currentTodo);
    updatedTodo.done = !updatedTodo.done; // Toggles between true and false
    
    if (updatedTodo.done) {
        updatedTodo.completedAt = Date.now();
        updatedTodo.usedEffort = usedEffort
    } else {
        updatedTodo.completedAt = null
    }

    // ⏱️ Small timeout for smooth UI animations in the Kanban board
    setTimeout(() => {
      // Optimistic UI update so the card vanishes nicely without lagging
      const optimisticList = this.todosSignal().map(t => t.id === todoId ? updatedTodo : t);
      this.todosSignal.set(optimisticList);

      // 3. Hand the fully prepared object over to the DataManager
      this.dataManager.updateTodo(updatedTodo, optimisticList, userId).subscribe({
        next: (finalList) => {
          this.updateTodosState(finalList);
          this.loggerService.info("todoService", "Full todo update successfully processed.");
        },
        error: (err) => {
          this.loggerService.warn('TODO_SERVICE', 'Update failed, triggering rollback...', err);
          this.loadTodosFromBackend(userId); // Safe rollback from database
        }
      });
    }, 500);
  }

  public addPoint(id: string) {
    const todoToUpdate = this.todosSignal().find(t => t.id === id); //
    if (!todoToUpdate) return; //

    todoToUpdate.usedEffort++; //

    setTimeout(() => {
      this.dataManager.updateTodo(todoToUpdate, this.todosSignal(), todoToUpdate.userId).subscribe({
        next: (neueListe) => {
          this.updateTodosState(neueListe);
        },
        error: (err) => this.handleBackendError(err, false)
      });
    }, 500); //
  }

  public createTodo(todo: Todo): Todo {
    return Todo.fromTodo(todo); 
  }

  public deleteTodo(id: string) {
    if (this.undoTimeoutRef !== null) {
      clearTimeout(this.undoTimeoutRef); 
      this.undoTimeoutRef = null; 
    }

    const todoToDelete = this.todosSignal().find(t => t.id === id); 
    if (!todoToDelete) return; 

    this.deletedTodosBackup = [todoToDelete]; 
    this.lastDeletedTaskName.set(`"${todoToDelete.task}"`); 
    this.isUndoActive.set(false); 
    this.showUndoToast.set(true); 

    this.todosSignal.set(this.todosSignal().filter(t => t.id !== id)); 

    this.undoTimeoutRef = setTimeout(() => {
      if (this.isUndoActive()) return; 

      const userId = this.userService.getCurrentUserId();
      if (!userId) return;

      this.dataManager.deleteTodo(id, this.todosSignal(), userId).subscribe({
        next: (listeNachLoeschen) => {
          this.showUndoToast.set(false); 
          this.deletedTodosBackup = []; 
          this.undoTimeoutRef = null; 
        },
        error: (err) => this.handleBackendError(err, true) 
      });
    }, 5000); 
  }

  public undoDelete() {
    this.isUndoActive.set(true); //
    this.showUndoToast.set(false); //

    if (this.undoTimeoutRef !== null) {
      clearTimeout(this.undoTimeoutRef); //
      this.undoTimeoutRef = null; //
    }

    if (this.deletedTodosBackup.length > 0) {
      this.todosSignal.set([...this.deletedTodosBackup, ...this.todosSignal()]); //
      this.deletedTodosBackup = []; //
    }
  }

  public getTodosForMilestone(id: string | null): Todo[] {
    if (!id) {
       return [];
    }
     return this.filteredTodos().filter(t => t.milestoneId === id)
  }

  public clearCompletedTodos(): void {
    const userId = this.userService.getCurrentUserId(); //
    if (!userId) return; //

    const completedTodos = this.todosSignal().filter(t => t.done); //
    if (completedTodos.length === 0) return; //

    if (this.undoTimeoutRef) clearTimeout(this.undoTimeoutRef); //

    this.deletedTodosBackup = completedTodos; //
    this.lastDeletedTaskName.set(`${completedTodos.length} erledigte Aufgaben`); //
    this.isUndoActive.set(false); //
    this.showUndoToast.set(true); //

    this.todosSignal.set(this.todosSignal().filter(t => !t.done)); //

    this.undoTimeoutRef = setTimeout(() => {
      if (this.isUndoActive()) return;

      this.dataManager.deleteCompletedTodos(userId, this.todosSignal()).subscribe({
        next: (listeNachLoeschen) => {
          this.showUndoToast.set(false); //
          this.deletedTodosBackup = []; //
          this.undoTimeoutRef = null;
        },
        error: (err) => this.handleBackendError(err, true)
      });
    }, 5000); //
  }

  public clearAllTodos(): void {
    const userId = this.userService.getCurrentUserId(); //
    if (!userId) return; //

    const allTodos = this.todosSignal(); //
    if (allTodos.length === 0) return; //

    if (this.undoTimeoutRef) clearTimeout(this.undoTimeoutRef); //

    this.deletedTodosBackup = allTodos; //
    this.lastDeletedTaskName.set('Alle Aufgaben von deinem Board'); //
    this.isUndoActive.set(false); //
    this.showUndoToast.set(true); //

    this.todosSignal.set([]); //

    this.undoTimeoutRef = setTimeout(() => {
      if (this.isUndoActive()) return;

      this.dataManager.deleteAllTodos(userId).subscribe({
        next: (leereListe) => {
          this.showUndoToast.set(false); //
          this.deletedTodosBackup = []; //
          this.undoTimeoutRef = null;
        },
        error: (err) => this.handleBackendError(err, true)
      });
    }, 5000); //
  }

  public clearGlobalError() {
    this.globalError.set(null); //
  }

  private handleBackendError(err: any, isDelayedAction: boolean): void {
    this.loggerService.error('STATE_CHANGE', 'Mutation fehlgeschlagen', err); //

    const errorCode: ErrorCode = err.error?.errorCode; //

    if (errorCode === ErrorCode.UserNotFound) { //
      console.warn('Zentraler Handler: User in DB gelöscht. Setze nur State zurück!'); //
      this.userService.logout(); //
      return; //
    }

    if (errorCode === ErrorCode.TodoNotFound) { //
      alert('Huch! Diese Aufgabe existiert nicht mehr auf dem Server. 📋'); //
      const userId = this.userService.getCurrentUserId(); //
      if (userId) this.loadTodosFromBackend(userId); //
      return; //
    }

    this.globalError.set('Aktion fehlgeschlagen. Verbindung zum Server verloren.'); //

    if (isDelayedAction) { //
      if (this.deletedTodosBackup.length > 0) { //
        this.todosSignal.set([...this.deletedTodosBackup, ...this.todosSignal()]); //
        this.deletedTodosBackup = []; //
      }
      this.isUndoActive.set(false); //
      this.undoTimeoutRef = null; //
    }
  }

  // --- COMPUTED STATES (Umfangreiche Filterlogik zurückgeholt!) ---
  public isListEmpty = computed(() => this.todosSignal().length === 0); //

  public totalOpenEffort = computed(() => {
    const todos = this.todosSignal().filter(t => !t.done); //
    return todos.reduce((prev, t) => prev + (t.effort || 0), 0); //
  });

  public filteredTodos = computed(() => {
    const todos = this.todosSignal(); //
    const filter = this.filterSignal(); //
    const searchQuery = this.searchQuerySignal(); //
    const now = Date.now(); //
    const todayStart = new Date().setHours(0, 0, 0, 0); //
    const todayEnd = new Date().setHours(23, 59, 59, 999); //
    let result: Todo[] = []; //

    switch (filter) {
      case Filter.OPEN:
        result = todos.filter(t => !t.done).sort((a, b) => a.dueDate - b.dueDate); //
        break;
      case Filter.COMPLETED:
        result = todos.filter(t => t.done).sort((a, b) => a.completedAt! - b.completedAt!); //
        break;
      case Filter.DUE_TODAY:
        result = todos.filter(t => !t.done && t.dueDate >= todayStart && t.dueDate <= todayEnd) //
          .sort((a, b) => a.dueDate - b.dueDate); //
        break;
      case Filter.OVERDUE:
        result = todos.filter(t => !t.done && t.dueDate < now) //
          .sort((a, b) => a.dueDate - b.dueDate); //
        break;
      default:
        result = [...todos].sort((a, b) => { //
          const getWeight = (t: Todo) => {
            return t.done ? 1 : 0; //
          };
          const weightA = getWeight(a); //
          const weightB = getWeight(b); //
          if (weightA !== weightB) return weightA - weightB; //

          if (!a.done) { //
            if (a.dueDate !== b.dueDate) { //
              return a.dueDate - b.dueDate; //
            }
            return (a.createdAt || 0) - (b.createdAt || 0); //
          }

          return Number(a.createdAt) - Number(b.createdAt); //
        });
    }

    if (searchQuery) { //
      result = result.filter(t => //
        t.task.toLowerCase().includes(searchQuery) || //
        t.description?.toLowerCase().includes(searchQuery) //
      );
    }

    return result; //
  });

  public statistics = computed(() => {
    const statistics = new Statistics(); //
    const todos = this.todosSignal(); //
    statistics.total = todos.length; //

    const now = Date.now(); //
    const todayStart = new Date().setHours(0, 0, 0, 0); //
    const todayEnd = new Date().setHours(23, 59, 59, 999); //

    todos.forEach(todo => { //
      if (todo.done) { //
        statistics.completed++; //
      } else { //
        statistics.open++; //
        if (todo.dueDate < now) statistics.overdue++; //
        if (todo.dueDate >= todayStart && todo.dueDate <= todayEnd) statistics.dueToday++; //
      }
    });
    return statistics; //
  });

  public totalEffort = computed(() => {
    const tasks = this.filteredTodos(); //
    const filter = this.filterSignal(); //
    const effortType = filter === Filter.COMPLETED ? EffortType.COMPLETED : EffortType.OPEN; //

    if (tasks.length === 0) { //
      return new Effort(0, effortType); //
    }

    const list = effortType === EffortType.COMPLETED //
      ? tasks.filter(t => t.done) //
      : tasks.filter(t => !t.done); //

    const total = list.reduce((sum, todo) => sum + todo.effort, 0); //
    return new Effort(total, effortType); //
  });

  /**
   * 🔮 Brücke für den KI-Vorschlag
   */
  public getAiCategorySuggestion(text: string, userId: string): Observable<{ suggestedCategory: string }> {
    // Reicht die Anfrage eins zu eins sauber an das Repository weiter
    return this.todoRepository.getAiCategorySuggestion(text, userId);
  }

  /**
   * 📋 Brücke für die dynamischen Server-Kategorien
   */
  public getServerCategories(userId: string): Observable<string[]> {
    // Reicht die Anfrage eins zu eins sauber an das Repository weiter
    return this.todoRepository.getServerCategories(userId);
  }
}
