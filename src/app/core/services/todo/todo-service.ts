import { Injectable, signal, computed, inject } from '@angular/core';
import { Todo } from '../../models/todo';
import { Observable } from 'rxjs';
import { UserService } from '../user/user-service';
import { TodoDataManagerService } from './todo-data-manager-service';
import { TodoRepository } from '../../repositories/todo-repository';
import { NotificationService } from '../notification/notification-service';

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
  private todoRepository = inject(TodoRepository);
  private notificationService = inject(NotificationService);

  // --- REAKTIVER STATE (SIGNALS & GLOBAL POOL) ---
  private allTodosPool = this.dataManager.allTodosPool;

  public readonly todosSignal = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];
    return this.allTodosPool().filter(t => t.userId === currentUserId);
  });

  public filterSignal = signal(Filter.ALL);
  public searchQuerySignal = signal('');
  public gamificationState = signal(null);
  public streakState = computed(() => this.dataManager.streakSignal());

  public fibonacciSequence: number[];
  public globalError = signal<string | null>(null);

  // Spiegelung des Gamification-Signals aus dem DataManager
  public latestGamificationResult = this.dataManager.gamificationSignal;

  // --- COMPUTED STATES FOR BOARDS ---
  public openTodosOnly = computed(() => this.todosSignal().filter(t => !t.done));
  public allTodos = computed(() => this.allTodosPool());

  public focusedTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];

    return this.allTodos().filter(t => {
      if (!t.milestoneId) return true;
      return t.assignedUserId === currentUserId;
    });
  });

  public completedTeamHistoryTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];

    return this.allTodos().filter(t => {
      if (!t.milestoneId) return false;
      return t.lastDeveloperId === currentUserId && (t.done || t.teamStatus === 'DONE');
    });
  });

  public privateTodos = computed(() => this.allTodos().filter(t => !t.milestoneId));
  public milestoneBoardTodos = computed(() => this.allTodos());
  public teamTodos = computed(() => this.allTodos().filter(t => !!t.milestoneId));

  public userContributionTodos = computed(() => {
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) return [];

    return this.allTodos().filter(t => {
      if (!t.milestoneId || t.assignedUserId === currentUserId) return true;
      const wasDeveloper = t.lastDeveloperId === currentUserId && (t.done || t.teamStatus === 'DONE');
      const wasReviewer = t.reviewerId === currentUserId;
      return wasDeveloper || wasReviewer;
    });
  });

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

  constructor() {
    this.fibonacciSequence = this.initFibonacciSequence(40);
  }

  public getTodoById(id: string): Todo | undefined {
    return this.todosSignal().find(t => t.id === id);
  }

  public getQuickPredictions(modus: 'PAUSE' | 'ACTIVE'): Observable<string[]> {
    return this.dataManager.getQuickPredictions(modus);
  }

  private initFibonacciSequence(limit: number): number[] {
    const sequence = [1, 2];
    while (true) {
      const next = sequence[sequence.length - 1] + sequence[sequence.length - 2];
      if (next > limit) break;
      sequence.push(next);
    }
    return sequence;
  }

  // --- ACTIONS (MUTATIONS VIA DATA MANAGER) ---

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

  // --- STATISTIKEN & SUGGESTIONS ---
  public getAiCategorySuggestion(text: string, userId: string): Observable<{ suggestedCategory: string }> {
    return this.todoRepository.getAiCategorySuggestion(text, userId);
  }

  public getServerCategories(userId: string): Observable<string[]> {
    return this.todoRepository.getServerCategories(userId);
  }

  public resetData(): void {
    this.filterSignal.set(Filter.ALL);
    this.searchQuerySignal.set('');
    this.gamificationState.set(null);
  }
}