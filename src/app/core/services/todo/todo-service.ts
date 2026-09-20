import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Todo } from '../../models/todo';
import { Observable } from 'rxjs';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { GamificationResult } from '../../models/gamification';
import { TodoDataManagerService } from './todo-data-manager-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { TodoQueryService } from './todo-query-service';
import { NotificationService } from '../notification/notification-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

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
export class TodoService extends BaseDataManager {
  private dataManager = inject(TodoDataManagerService);
  private userService = inject(UserService);
  private todoRepository = inject(TodoRepository);
  private notificationService = inject(NotificationService);

  // --- REAKTIVER STATE (SIGNALS & GLOBAL POOL) ---
  // 🌍 DER TRICK: Verweist jetzt direkt auf das Signal im DataManager!
  private allTodosPool = this.dataManager.allTodosPool;

  // 👤 Die Brücke für die UI: Filtert den Pool vollautomatisch auf deine Aufgaben!
  public todosSignal = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];
    return this.allTodosPool().filter(t => t.userId === currentUserId);
  });

  public filterSignal = signal(Filter.ALL);
  public searchQuerySignal = signal('');
  public gamificationState = signal(null);
  public streakState = computed(() => this.dataManager.streakSignal());

  public fibonacciSequence: number[];
  public globalError = signal(null);

  // 🟢 Spiegelung des Gamification-Signals aus dem DataManager
  public latestGamificationResult = this.dataManager.gamificationSignal;

  // --- COMPUTED STATES ---
  public openTodosOnly = computed(() => {
    return this.todosSignal().filter(t => !t.done);
  });

  public allTodos = computed(() => {
    return this.allTodosPool();
  });

  // ==========================================
  // 🌍 BOARD 1: Die persönliche To-Do-Liste (TodoListComponent)
  // ==========================================
  // 1. 🎯 AKTUELLE ARBEITSLISTE: Was du JETZT tun musst + deine privaten Todos
  public focusedTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];

    return this.allTodos().filter(t => {
      if (!t.milestoneId) return true; // Private Aufgaben

      // Team-Aufgabe: Dir aktuell zugewiesen (ist automatisch noch offen)
      return t.assignedUserId === currentUserId;
    });
  });

  // 2. 🏆 ERFOLGE / HISTORY: Von dir erledigte Team-Aufgaben
  public completedTeamHistoryTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];

    return this.allTodos().filter(t => {
      if (!t.milestoneId) return false;

      // Von dir als Dev fertiggestellt
      return t.lastDeveloperId === currentUserId && (t.done || t.teamStatus === 'DONE');
    });
  });

  // ==========================================
  // 👥 BOARD 2: Privates Board (TodoKanbanComponent)
  // ==========================================
  // Zeigt: AUSSCHLIESSLICH private Aufgaben (Kein Meilenstein/Projekt)
  public privateTodos = computed(() => {
    return this.allTodos().filter(t => !t.milestoneId);
  });

  // ==========================================
  // 🏛️ BOARD 3: Project Milestone Board (ProjectMilestoneComponent)
  // ==========================================
  // Anforderung: Eigene private Aufgaben, um sie zuzuordnen PLUS alle Team-Aufgaben
  // Zeigt: ALLES (weil der User hier die Brücke zwischen Privat und Team baut!)
  public milestoneBoardTodos = computed(() => {
    return this.allTodos(); // Einfach der gesamte Pool!
  });

  // ==========================================
  // 🤝 BOARD 4: Team Board (TeamBoardComponent)
  // ==========================================
  // Anforderung: Nur Team-Aufgaben sehen, zuweisen, bearbeiten. KEINE privaten Aufgaben!
  // Zeigt: Nur Aufgaben, die zu einem Meilenstein/Projekt gehören
  public teamTodos = computed(() => {
    return this.allTodos().filter(t => !!t.milestoneId);
  });

  // ==========================================
  // 📊 STATISTIK & IMPACT POOL (userContributionTodos)
  // ==========================================
  // Liefert alle Aufgaben, an denen der User mitgewirkt hat:
  // 1. Seine aktiven/privaten Aufgaben (focusedTodos)
  // 2. Team-Aufgaben, die ER als Developer abgeschlossen hat (lastDeveloperId)
  // 3. Team-Aufgaben, die ER gecheckt/geprüft hat (reviewerId)
  public userContributionTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];

    return this.allTodos().filter(t => {
      // 1. Alle aus focusedTodos (Privat + aktuell zugewiesene offene Team-Todos)
      if (!t.milestoneId || t.assignedUserId === currentUserId) return true;

      // 2. Team-Aufgabe von ihm als Entwickler erledigt
      const wasDeveloper = t.lastDeveloperId === currentUserId && (t.done || t.teamStatus === 'DONE');

      // 3. Team-Aufgabe von ihm als Reviewer geprüft / abgenommen
      const wasReviewer = t.reviewerId === currentUserId;

      return wasDeveloper || wasReviewer;
    });
  });

  constructor() {
    super();
    this.fibonacciSequence = this.initFibonacciSequence(40);
  }

  /**
   * 🔍 Sucht ein To-Do anhand seiner ID aus dem aktuellen Signal-Zustand.
   */
  public getTodoById(id: string): Todo | undefined {
    return this.todosSignal().find(t => t.id === id);
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

  // --- STATE MUTATIONS ---

  public createAndAddTodo(input: {
    task: string,
    description: string | null,
    effort: number,
    dueDate: number,
    category?: string,
    milestoneId?: string | null,
    isStarted?: boolean
  }): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    const newTodo = new Todo({ ...input, userId, isStarted: input.isStarted ?? false });
    this.dataManager.createTodo(newTodo);
  }

  public createTodo(todo: Todo): Todo {
    return Todo.fromTodo(todo);
  }

  public addDoneTodo(todo: Todo): void {
    this.dataManager.createTodo(todo);
  }

  public updateTodo(updatedTodo: Todo, isDragAndDrop: boolean = false): void {
    // Das synchrone `.update(...)` entfällt, weil allTodosPool ein Readonly-Signal ist!
    // Wir delegieren die Änderung direkt an den DataManager:
    const delay = isDragAndDrop ? 0 : 300;

    setTimeout(() => {
      this.dataManager.updateTodo(updatedTodo);
    }, delay);
  }

  public updateTodoEffort(todoId: string, newEffort: number): void {
    const todoToUpdate = this.allTodosPool().find(t => t.id === todoId);
    if (!todoToUpdate || todoToUpdate.done) return;

    const updated = new Todo({ ...todoToUpdate, effort: newEffort });

    setTimeout(() => {
      this.dataManager.updateTodo(updated);
    }, 300);
  }

  public toggleComplete(todoId: string, usedEffort: number): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    const currentTodo = this.allTodosPool().find(t => t.id === todoId);
    if (!currentTodo) return;

    const updatedTodo = Todo.fromTodo(currentTodo);
    updatedTodo.done = !updatedTodo.done;

    if (updatedTodo.done) {
      updatedTodo.completedAt = Date.now();
      updatedTodo.usedEffort = usedEffort;
    } else {
      updatedTodo.completedAt = null;
    }

    setTimeout(() => {
      this.dataManager.updateTodo(updatedTodo);
    }, 500);
  }

  public addPoint(id: string): void {
    const todoToUpdate = this.allTodosPool().find(t => t.id === id);
    if (!todoToUpdate) return;

    const updated = Todo.fromTodo(todoToUpdate);
    updated.usedEffort++;

    setTimeout(() => {
      this.dataManager.updateTodo(updated);
    }, 500);
  }

  public deleteTodoDirectly(id: string): void {
    this.dataManager.deleteTodo(id);
  }

  public getTodosForMilestone(id: string | null): Todo[] {
    if (!id) return [];
    return this.filteredFocusedTodos().filter(t => t.milestoneId === id);
  }

  public clearCompletedTodos(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.dataManager.deleteCompleted(userId);
    this.notificationService.showNotification("Erledigte private Aufgaben wurden erfolgreich archiviert! 🧹", "success");
  }

  public clearAllTodos(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.dataManager.deleteAll(userId);
    this.notificationService.showNotification("Dein privates Board wurde komplett geleert! 🔥", "success");
  }

  // --- COMPUTED STATES & FILTERING ---
  public isListEmpty = computed(() => this.todosSignal().length === 0);

  public filteredFocusedTodos = computed(() => {
    const todos = this.focusedTodos();
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
        result = todos.filter(t => t.done).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
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
          const getWeight = (t: Todo) => (t.done ? 1 : 0);
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
    const tasks = this.filteredFocusedTodos();
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

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.filterSignal.set(Filter.ALL);
    this.searchQuerySignal.set('');
    this.gamificationState.set(null);
  }
}