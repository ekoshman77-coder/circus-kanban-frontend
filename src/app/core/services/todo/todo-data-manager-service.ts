import { Injectable, inject, Signal, signal } from '@angular/core';
import { Todo } from '../../models/todo';
import { TodoRepository } from '../../repositories/todo-repository';
import { combineLatest, Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap, filter } from 'rxjs/operators';
import { GamificationResult } from '../../models/gamification';
import { UserService } from '../user/user-service';
import { TodoUpdateResponse } from '../../repositories/dto/dto-interface';
import { StreakInfoDto } from '../../models/streak.info-dto';
import { toObservable } from '@angular/core/rxjs-interop';
import { StreakRepository } from '../../repositories/streak-repository';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { ConnectionService } from '../connection/connection-service';
import { TodoAction, TodoBulkPayload, TodoDeletePayload, TodoPayload } from '../../models/queue-items/todo-queue-payload';
import { TodoStateProvider } from './todo-data-provider';
import { StateProvider } from '../central-queue/state-providers/base-state-provider';
import { QueueHandlerName } from '../../enums/queue-handler-name';

@Injectable({
  providedIn: 'root'
})
export class TodoDataManagerService extends BaseQueueDataManager {
  private todoRepository = inject(TodoRepository);
  private userService = inject(UserService);
  private connectionService = inject(ConnectionService);
  private streakRepository = inject(StreakRepository);

  private readonly PREDICTIONS_ACTIVE_KEY = 'cached_predictions_active';
  private readonly PREDICTIONS_PAUSE_KEY = 'cached_predictions_pause';

  private readonly fallbackPauseTodos = ['Kaffee trinken', 'Dehnen', 'Wasser holen', 'Kurz lüften'];
  private readonly fallbackActiveTodos = ['Refactoring UI', 'Bugfix Service', 'Code Review', 'Doku schreiben'];

  public gamificationSignal = signal<GamificationResult | null>(null);
  public streakSignal = signal<StreakInfoDto | null>(null);

    public get allTodosPool(): Signal<Todo[]> {
    return this.getSignal() as Signal<Todo[]>;
  }

  // 🎯 Hilfsmethode: Holt die Aufgabenbezeichnung aus dem State (Fallback für ID-Only/Update operations)
  private getTodoTaskById(id: string): string {
    const todo = this.allTodosPool().find((t) => t.id === id);
    return todo?.task || 'Unbenannte Aufgabe';
  }

  constructor() {
    super(QueueHandlerName.TODO);

    // Initialer Cache-Load über den Provider
    this.loadInitialCache();

    // Streak-Sync bei aktivem Login & Online-Status
    combineLatest([
      toObservable(this.userService.currentUser),
      toObservable(this.connectionService.status)
    ])
      .pipe(
        filter(([user, status]) => user !== null && status === 'ONLINE'),
        switchMap(([user]) => this.streakRepository.syncAndGetStreakInfo(user!.id))
      )
      .subscribe({
        next: (streakInfo) => this.streakSignal.set(streakInfo),
        error: (err) => console.error('🔋 [DataManager-Streak] Fehler:', err)
      });
  }

  protected override createStateProvider(): StateProvider<Todo[]> {
    return new TodoStateProvider();
  }

  
  // ==========================================
  // PUBLIC ACTIONS (Optimistic Updates + Queue)
  // ==========================================

public createTodo(todo: Todo): void {
    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('CREATE', { todo });

    const payload: TodoPayload = {
      id: todo.id,
      todo,
      snapshot,
      displayInfo: {
        category: 'Aufgabe erstellen',
        title: todo.task || 'Unbenannte Aufgabe'
      }
    };
    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public updateTodo(updatedTodo: Todo): void {
    const snapshot = this.stateProvider.createSnapshot();
    const taskTitle = updatedTodo.task || this.getTodoTaskById(updatedTodo.id);

    this.stateProvider.applyActionPayload('UPDATE', { todo: updatedTodo });

    const payload: TodoPayload = {
      id: updatedTodo.id,
      todo: updatedTodo,
      snapshot,
      displayInfo: {
        category: 'Aufgabe bearbeiten',
        title: taskTitle
      }
    };
    this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
  }

  public deleteTodo(id: string): void {
    const snapshot = this.stateProvider.createSnapshot();
    const taskTitle = this.getTodoTaskById(id);

    this.stateProvider.applyActionPayload('DELETE', { id });

    const payload: TodoDeletePayload = {
      id,
      snapshot,
      displayInfo: {
        category: 'Aufgabe löschen',
        title: taskTitle
      }
    };
    this.queueService.enqueue(this.serviceName, 'DELETE', payload);
  }

  public deleteCompleted(userId: string): void {
    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('BULK_DELETE_COMPLETED', { userId });

    const payload: TodoBulkPayload = {
      id: 'bulk-completed',
      userId,
      snapshot,
      displayInfo: {
        category: 'Massen-Aktion',
        title: 'Erledigte Aufgaben löschen'
      }
    };
    this.queueService.enqueue(this.serviceName, 'BULK_DELETE_COMPLETED', payload);
  }

  public deleteAll(userId: string): void {
    const snapshot = this.stateProvider.createSnapshot();

    this.stateProvider.applyActionPayload('BULK_DELETE_ALL', { userId });

    const payload: TodoBulkPayload = {
      id: 'bulk-all',
      userId,
      snapshot,
      displayInfo: {
        category: 'Massen-Aktion',
        title: 'Alle Aufgaben löschen'
      }
    };
    this.queueService.enqueue(this.serviceName, 'BULK_DELETE_ALL', payload);
  }
  
  // ==========================================
  // QUEUE EXECUTION & FETCH
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as TodoAction;
    const payload = item.payload;

    switch (action) {
      case 'CREATE': {
        const createPayload = payload as TodoPayload;
        const todoToSend = new Todo({ ...createPayload.todo, id: undefined });
        return this.todoRepository.createTodo(todoToSend);
      }
      case 'UPDATE': {
        const updatePayload = payload as TodoPayload;
        return this.todoRepository.updateTodo(updatePayload.todo);
      }
      case 'DELETE': {
        const deletePayload = payload as TodoDeletePayload;
        return this.todoRepository.deleteTodo(deletePayload.id);
      }
      case 'BULK_DELETE_COMPLETED': {
        const bulkPayload = payload as TodoBulkPayload;
        return this.todoRepository.deleteCompleted(bulkPayload.userId);
      }
      case 'BULK_DELETE_ALL': {
        const bulkPayload = payload as TodoBulkPayload;
        return this.todoRepository.deleteAll(bulkPayload.userId);
      }
      default:
        return throwError(() => new Error(`[TodoDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override handleQueueResult(item: QueueItem, success: boolean, response: any): void {
    super.handleQueueResult(item, success, response);

    if (success && item.action === 'UPDATE' && response) {
      const resp = response as TodoUpdateResponse;
      if (resp.gamificationResult) this.userService.updateGamification(resp.gamificationResult);
      if (resp.streakInfo) this.streakSignal.set(resp.streakInfo);
    }
  }

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.todoRepository.getRelevantTodos(userId).pipe(
      map((serverTodos: Todo[]): void => {
        const mappedTodos = serverTodos.map((t) => new Todo(t));
        this.stateProvider.applyActionPayload('SET_TODOS', { todos: mappedTodos });
      })
    );
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    super.checkAndReplaceIds(item, localId, serverId);
    const payload = item.payload;
    if (payload && 'todo' in payload && payload.todo) {
      const todoPayload = payload as TodoPayload;
      if (todoPayload.todo.milestoneId === localId) {
        todoPayload.todo.milestoneId = serverId;
      }
    }
  }

  public override extractEntityIds(item: QueueItem): string[] {
    const ids = super.extractEntityIds(item);
    const payload = item.payload;
    if (!payload) return ids;

    if ('todo' in payload && payload.todo) {
      const todo = payload.todo as Todo;

      // Nur Meilenstein-ID ist eine dynamisch erstelbare Abhängigkeit
      if (todo.milestoneId) {
        ids.push(todo.milestoneId);
      }
    }

    return ids;
  }

  public getQuickPredictions(modus: 'PAUSE' | 'ACTIVE'): Observable<string[]> {
    const getOfflineOrFallbackStrings = (): string[] => {
      const cacheKey = modus === 'PAUSE' ? this.PREDICTIONS_PAUSE_KEY : this.PREDICTIONS_ACTIVE_KEY;
      const cachedData = this.localStorageService.getItem<string[]>(cacheKey);
      return cachedData && cachedData.length > 0 ? cachedData : (modus === 'PAUSE' ? this.fallbackPauseTodos : this.fallbackActiveTodos);
    };

    if (this.connectionService.isOffline()) {
      return of(getOfflineOrFallbackStrings());
    }

    return this.todoRepository.getQuickPredictions(modus).pipe(
      map((predictions) => {
        if (predictions && predictions.length > 0) {
          const cacheKey = modus === 'PAUSE' ? this.PREDICTIONS_PAUSE_KEY : this.PREDICTIONS_ACTIVE_KEY;
          this.localStorageService.setItem(cacheKey, predictions);
          return predictions;
        }
        return getOfflineOrFallbackStrings();
      }),
      catchError(() => of(getOfflineOrFallbackStrings()))
    );
  }

  public override resetData(): void {
    super.resetData();
    this.localStorageService.removeItem(this.PREDICTIONS_ACTIVE_KEY);
    this.localStorageService.removeItem(this.PREDICTIONS_PAUSE_KEY);
    this.streakSignal.set(null);
  }
}