import { inject, Injectable, Signal, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { BaseQueueDataManager } from '../../central-queue/base-queue-data-manager';
import { TodoRepository } from '../../../repositories/todo-repository';
import { UserService } from '../../user/user-service';
import { ConnectionService } from '../../connection/connection-service';
import { QueueHandlerName } from '../../../enums/queue-handler-name';
import { Todo } from '../../../models/todo';
import { QueueItem } from '../../../models/queue-items/queue-item';
import { AdminTodoStateProvider } from './admin-todo-state-rpovider';
import { AdminTodoFilter } from '../../../repositories/dto/admin-todo-filter';
import { TodoAction } from '../../../models/queue-items/todo-queue-payload';

@Injectable({
  providedIn: 'root'
})
export class AdminTodoDataManagerService extends BaseQueueDataManager<AdminTodoStateProvider> {
  private todoRepository = inject(TodoRepository);
  private userService = inject(UserService);
  
  // 🌐 Unser smarter ConnectionService!
  public connectionService = inject(ConnectionService);

  // 🎛️ Zustand für Filter & Status
  public activeFilter = signal<AdminTodoFilter | null>(null);
  public isLoading = signal<boolean>(false);

  constructor() {
    super(QueueHandlerName.ADMIN_TODO);
  }

  protected override createStateProvider(): AdminTodoStateProvider {
    return new AdminTodoStateProvider();
  }

  public get adminTodosPool(): Signal<Todo[]> {
    return this.getSignal() as Signal<Todo[]>;
  }

  // ==========================================
  // 🔄 FETCH LOGIK (Online-Only / Direct Fetch)
  // ==========================================
  protected override fetchFromServer(userId: string): Observable<void> {
    const setTodosAction: TodoAction = 'SET_TODOS'
    const emptyPayload = {
        todos: []
    }

    // 🛡️ Guard 1: Echter Server-Verbindungs-Check über den ConnectionService
    if (!this.connectionService.isOnline()) {
      this.stateProvider.applyActionPayload(setTodosAction, emptyPayload);
      return of(undefined);
    }

    // 🛡️ Guard 2: Nur für Admins
    if (!this.userService.isAdmin()) {
      this.stateProvider.applyActionPayload(setTodosAction, emptyPayload);
      return of(undefined);
    }

    const filter = this.activeFilter();

    // 🛡️ Guard 3: Schutz vor Datenflut (Gültiges Filter-Kriterium erforderlich)
    const hasValidFilter = filter && (
      !!filter.projectId ||
      !!filter.targetUserId ||
      filter.isArchived === true ||
      (!!filter.departmentId && (!!filter.fromDate || !!filter.toDate || filter.isArchived !== undefined))
    );

    if (!hasValidFilter) {
      this.stateProvider.applyActionPayload(setTodosAction, emptyPayload);
      return of(undefined);
    }

    this.isLoading.set(true);

    // 🚀 Gefilterter Abruf direkt vom Server
    return this.todoRepository.getAdminTodosByFilter(filter).pipe(
      map((backendTodosJson) => {
        const liveTodos = backendTodosJson.map(json => Todo.fromJson(json));
        this.stateProvider.applyActionPayload(setTodosAction, {todos: liveTodos});
        this.isLoading.set(false);
      }),
      catchError((err) => {
        console.error('❌ [AdminTodoDataManager] Fehler beim Laden der gefilterten Todos:', err);
        this.stateProvider.applyActionPayload(setTodosAction, emptyPayload);
        this.isLoading.set(false);
        return of(undefined);
      })
    );
  }

  /**
   * 🎛️ Wird aufgerufen, wenn der Admin in der UI den Filter ändert
   */
  public applyFilter(newFilter: AdminTodoFilter): void {
    this.activeFilter.set(newFilter);
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId) {
        return
    }
    // Nutzt forceFetchFromServer aus der BaseClass (umgeht den Cooldown-Timer)
    this.forceFetchFromServer(currentUserId).subscribe();
  }

/**
   * 👑 Admin: To-Do archivieren (Soft-Delete) über die CentralQueue
   */
  public archiveTodo(id: string): void {
    const taskTitle = this.getAdminTodoTaskById(id);

    // 1. Lokalen State sofort aktualisieren (Optimistic / Immediate Feedback)
    this.stateProvider.applyActionPayload('DELETE', { id });

    // 2. Payload für die Queue bauen
    const payload = {
      id,
      displayInfo: {
        category: 'Admin-Verwaltung',
        title: `Archivieren: ${taskTitle}`
      }
    };

    // 3. In die CentralQueue einspeisen!
    this.queueService.enqueue(this.serviceName, 'DELETE', payload);
  }

  /**
   * 👑 Admin: To-Do aus dem Archiv wiederherstellen über die CentralQueue
   */
  public restoreTodo(id: string): void {
    const taskTitle = this.getAdminTodoTaskById(id);

    // 1. Lokalen State sofort aktualisieren
    this.stateProvider.applyActionPayload('RESTORE', { id });

    // 2. Payload für die Queue bauen
    const payload = {
      id,
      displayInfo: {
        category: 'Admin-Verwaltung',
        title: `Wiederherstellen: ${taskTitle}`
      }
    };

    // 3. In die CentralQueue einspeisen!
    this.queueService.enqueue(this.serviceName, 'RESTORE', payload);
  }

  // Kleine Hilfsmethode, um den Titel für das DisplayInfo zu finden
  private getAdminTodoTaskById(id: string): string {
    const todo = this.adminTodosPool().find(t => t.id === id);
    return todo?.task || 'Unbenanntes Ticket';
  }

  // ==========================================
  // 🚫 LEERE ROLLBACKS (Kein Snapshot-Müll)
  // ==========================================
  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action;
    const payload = item.payload;

    switch (action) {
      case 'RESTORE': {
        return this.todoRepository.restoreAdminTodo(payload.id).pipe(
            switchMap(() => this.forceFetchFromServer())
        );
      }
      case 'DELETE': {
        return this.todoRepository.deleteTodo(payload.id).pipe(
            switchMap(() => this.forceFetchFromServer())
        );
      }

      default:
        return throwError(() => new Error(`[AdminTodoDataManager] Unbekannte Action: ${action}`));
    }
  }

  protected override handleWithoutSnapshot(item: QueueItem): void {
  }
}