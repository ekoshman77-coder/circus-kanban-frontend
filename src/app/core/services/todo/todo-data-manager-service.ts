import { Injectable, inject, signal } from '@angular/core';
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
import { ITodoJSON } from '../../repositories/dto/todo-json';
import { TodoBulkPayload, TodoDeletePayload, TodoPayload } from '../../models/queue-items/todo-queue-payload';

export type TodoAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'BULK_DELETE_COMPLETED'
  | 'BULK_DELETE_ALL';

@Injectable({
  providedIn: 'root'
})
export class TodoDataManagerService extends BaseQueueDataManager {

  private todoRepository = inject(TodoRepository);
  private userService = inject(UserService);
  private connectionService = inject(ConnectionService);
  private streakRepository = inject(StreakRepository);

  private readonly CACHE_KEY = 'global_todos_pool';
  private readonly PREDICTIONS_ACTIVE_KEY = 'cached_predictions_active';
  private readonly PREDICTIONS_PAUSE_KEY = 'cached_predictions_pause';

  // Fallbacks bei leerem Cache
  private readonly fallbackPauseTodos = ['Kaffee trinken', 'Dehnen', 'Wasser holen', 'Kurz lüften'];
  private readonly fallbackActiveTodos = ['Refactoring UI', 'Bugfix Service', 'Code Review', 'Doku schreiben'];

  public allTodosPool = signal<Todo[]>([]);
  public gamificationSignal = signal<GamificationResult | null>(null);
  public streakSignal = signal<StreakInfoDto | null>(null);

  constructor() {
    super('TodoDataManagerService');

    // Streak-Sync bei aktivem Login & Online-Status
    combineLatest([
      toObservable(this.userService.currentUser),
      toObservable(this.connectionService.status)
    ])
      .pipe(
        filter(([user, status]) => user !== null && status === 'ONLINE'),
        switchMap(([user, _]) => {
          console.log(`🔋 [DataManager-Streak] Starte sicheren Initial-Sync für User ${user!.id}...`);
          return this.streakRepository.syncAndGetStreakInfo(user!.id);
        })
      )
      .subscribe({
        next: (streakInfo) => {
          console.log('🔋 [DataManager-Streak] Batterie erfolgreich initialisiert:', streakInfo);
          this.streakSignal.set(streakInfo);
        },
        error: (err) => {
          console.error('🔋 [DataManager-Streak] Fehler beim Laden der Batterie:', err);
        }
      });
  }

  // ==========================================================================
  // 🚀 BASE QUEUE DATA MANAGER HOOKS
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as TodoAction;
    const payload = item.payload;

    switch (action) {
      case 'CREATE': {
        const createPayload = payload as TodoPayload;
        // 🛡️ Security: Backend erzeugt eigene ID -> Local-ID entfernen
        const todoToSend = new Todo({
          ...createPayload.todo,
          id: undefined
        });
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
        return throwError((): Error => new Error(`[TodoDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override handleQueueResult(item: QueueItem, success: boolean, response: any): void {
    // 🟢 Erst die Standard-Logik der Basisklasse ausführen (Rollbacks, Notifications, CREATE-Handling)
    super.handleQueueResult(item, success, response);

    // 🟢 Nur Todo-spezifische Side-Effects für UPDATE ergänzen
    if (success && item.action === 'UPDATE' && response) {
      const resp = response as TodoUpdateResponse;
      if (resp.gamificationResult) {
        this.userService.updateGamification(resp.gamificationResult);
      }
      if (resp.streakInfo) {
        this.streakSignal.set(resp.streakInfo);
      }
    }
  }

  public override resetState(snapshot: unknown): void {
    if (Array.isArray(snapshot)) {
      // 🟢 Aus ITodoJSON[] wieder echte Todo-Klasseninstanzen erzeugen
      const restored = (snapshot as ITodoJSON[]).map((json) => Todo.fromJson(json));
      this.allTodosPool.set(restored);
      this.saveToLocalStorage(restored);
    }
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    const realServerId = (response as any)?.id || response;

    // 🟢 Ersetzt die temporäre ID durch die echte Server-ID
    const updatedList = this.allTodosPool().map((t) => {
      if (t.id === tempId) {
        return new Todo({ ...t, id: String(realServerId) });
      }
      return t;
    });

    this.allTodosPool.set(updatedList);
    this.saveToLocalStorage(updatedList);
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    const payload = item.payload;
    if (!payload) return;

    // Prüfen, ob das Payload ein Todo enthält (z.B. CREATE oder UPDATE)
    if ('todo' in payload && payload.todo) {
      const todoPayload = payload as TodoPayload;
      if (todoPayload.todo.milestoneId === localId) {
        todoPayload.todo.milestoneId = serverId;
      }
    }
  }
  
  // ==========================================================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.todoRepository.getRelevantTodos(userId).pipe(
      map((serverTodos: Todo[]): void => {
        const mappedTodos = serverTodos.map((t) => new Todo(t));
        this.saveToLocalStorage(mappedTodos);
        this.allTodosPool.set(mappedTodos);
      })
    );
  }

  // ==========================================================================
  // 📋 PUBLIC CRUD METHODS
  // ==========================================================================

  public createTodo(todo: Todo): void {
    const snapshot = this.createSnapshotJson();
    const neueListe = [...this.allTodosPool(), todo].map((t) => new Todo(t));

    this.applyLocalStateUpdate(neueListe);

    const payload: TodoPayload = {
      id: todo.id,
      todo,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public updateTodo(updatedTodo: Todo): void {
    const snapshot = this.createSnapshotJson();
    const updatedList = this.allTodosPool().map((todo) => {
      if (todo.id === updatedTodo.id) {
        return new Todo(updatedTodo);
      }
      return new Todo(todo);
    });

    this.applyLocalStateUpdate(updatedList);

    const payload: TodoPayload = {
      id: updatedTodo.id,
      todo: updatedTodo,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
  }

  public deleteTodo(id: string): void {
    const snapshot = this.createSnapshotJson();
    const gefilterteListe = this.allTodosPool().filter((t) => t.id !== id);

    this.applyLocalStateUpdate(gefilterteListe);

    const payload: TodoDeletePayload = {
      id,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE', payload);
  }

  public deleteCompleted(userId: string): void {
    const snapshot = this.createSnapshotJson();
    const gefilterteListe = this.allTodosPool().filter((t) => !(t.done && !t.milestoneId));

    this.applyLocalStateUpdate(gefilterteListe);

    const payload: TodoBulkPayload = {
      id: 'bulk-completed',
      userId,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'BULK_DELETE_COMPLETED', payload);
  }

  public deleteAll(userId: string): void {
    const snapshot = this.createSnapshotJson();
    const gefilterteListe = this.allTodosPool().filter((t) => t.milestoneId);

    this.applyLocalStateUpdate(gefilterteListe);

    const payload: TodoBulkPayload = {
      id: 'bulk-all',
      userId,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'BULK_DELETE_ALL', payload);
  }

  // ==========================================================================
  // 💡 PREDICTIONS & HELPER
  // ==========================================================================

  public getQuickPredictions(modus: 'PAUSE' | 'ACTIVE'): Observable<string[]> {
    const getOfflineOrFallbackStrings = (): string[] => {
      const cacheKey = modus === 'PAUSE' ? this.PREDICTIONS_PAUSE_KEY : this.PREDICTIONS_ACTIVE_KEY;
      const cachedData = this.localStorageService.getItem<string[]>(cacheKey);

      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      return modus === 'PAUSE' ? this.fallbackPauseTodos : this.fallbackActiveTodos;
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

  private createSnapshotJson(): ITodoJSON[] {
    return this.allTodosPool().map((todo) => todo.toJson());
  }

  private applyLocalStateUpdate(updatedList: Todo[]): void {
    this.saveToLocalStorage(updatedList);
    this.allTodosPool.set(updatedList);
  }

  private saveToLocalStorage(todos: Todo[]): void {
    this.localStorageService.setItem(this.CACHE_KEY, todos);
  }

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.allTodosPool.set([]);
    this.localStorageService.removeItem(this.CACHE_KEY);
    this.localStorageService.removeItem(this.PREDICTIONS_ACTIVE_KEY);
    this.localStorageService.removeItem(this.PREDICTIONS_PAUSE_KEY);
    this.streakSignal.set(null);
  }
}