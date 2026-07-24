import { Inject, Injectable, effect, inject, signal } from '@angular/core';
import { Todo } from '../../models/todo';
import { TodoRepository } from '../../repositories/todo-repository';
import { ConnectionService } from '../connection/connection-service';
import { LocalStorageService } from '../user/local-storage-service';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators'; // 💡 tap importiert!
import { GamificationResult } from '../../models/gamification';
import { SyncResult } from '../../repositories/dto/sync-result';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { TodoUpdateResponse } from '../../repositories/dto/dto-interface';
import { TodoBulkDto } from '../../models/todo-bulk';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

@Injectable({
  providedIn: 'root'
})
export class TodoDataManagerService extends BaseDataManager {
  private todoRepository = inject(TodoRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService)
  // private localStorageService = inject(LocalStorageService);

  private readonly CACHE_KEY = 'global_todos_pool';
  private readonly OFFLINE_CHANGES_KEY = 'offline_todos_queue';
  private readonly PREDICTIONS_ACTIVE_KEY = 'cached_predictions_active';
  private readonly PREDICTIONS_PAUSE_KEY = 'cached_predictions_pause';

  // 2. Die ultimativen Notfall-Fallbacks (wenn der Cache komplett leer ist)
  private readonly fallbackPauseTodos = ['Kaffee trinken', 'Dehnen', 'Wasser holen', 'Kurz lüften'];
  private readonly fallbackActiveTodos = ['Refactoring UI', 'Bugfix Service', 'Code Review', 'Doku schreiben'];
  // 🌍 Das Signal ist jetzt beschreibbar (nicht mehr 'readonly' für diesen Service)
  public allTodosPool = signal<Todo[]>([]);

  public gamificationSignal = signal<GamificationResult | null>(null);
  public syncCompleted = signal<SyncResult | null>(null);
  private loggerService = Inject(LoggerService)

  constructor() {
    super()
    effect(() => {
      const status = this.connectionService.status();
      if (status === 'UNKNOWN') return;

      if (status === 'ONLINE') {
        const currentUser = this.userService.currentUser();
        if (!currentUser) return;
        this.triggerBulkSync(currentUser.id);
      }
    });
  }

  private triggerBulkSync(userId: string): void {
    // 🎯 Holt die intelligenten Bulk-DTOs mit ihren Zettelchen aus dem Storage
    const offlineTodos = this.getBulkQueueFromStorage();
    if (!offlineTodos || offlineTodos.length === 0) return;

    // Wir übergeben das saubere Array an das Repository
    this.todoRepository.syncBulkTodos(userId, offlineTodos).subscribe({
      next: (result) => {
        this.syncCompleted.set(result);
        // Pool mit der vom Server korrigierten (und um Projekt-Todos ergänzten) Liste befüllen
        this.allTodosPool.set(result.liste.map(t => new Todo(t)));

        // 🧼 Wenn alles erfolgreich war: Die Offline-Warteschlange leeren!
        return this.clearLocalOfflineStorage();
      },
      error: (err) => {
        console.error('Fehler beim Bulk-Sync:', err);
        // Im Fehlerfall lassen wir die Queue im Storage, damit beim nächsten
        // Netzwerkhubbel ein neuer Versuch gestartet wird.
      }
    });
  }

  private clearLocalOfflineStorage(): void {
    localStorage.removeItem(this.OFFLINE_CHANGES_KEY);
  }

  public clearSyncResult(): void {
    this.syncCompleted.set(null);
  }

  /**
   * 📋 DATEN LADEN
   */
  // In todo-data-manager-service.ts modifizieren:

  /**
   * 📋 DATEN RELEVANT LADEN (Ersetzt die alte loadTodos Methode)
   */
  public loadTodos(userId: string): Observable<Todo[]> {
    const cachedJSON = this.localStorageService.getItem<any[]>(this.CACHE_KEY) || [];
    let echteTodoObjekte: Todo[] = [];
    try {
      echteTodoObjekte = cachedJSON.map((t) => new Todo(t));
    } catch (e) {
      console.error('Fehler beim Instanziieren:', e);
    }

    if (this.connectionService.status() === 'OFFLINE') {
      this.allTodosPool.set(echteTodoObjekte);
      return of(echteTodoObjekte);
    }

    // 🎯 NUTZT JETZT DEN NEUEN RELEVANT-ENDPUNKT:
    return this.todoRepository.getRelevantTodos(userId).pipe(
      map(serverTodos => {
        const geladeneTodos = serverTodos && serverTodos.length > 0 ? serverTodos : echteTodoObjekte;
        const mappedTodos = geladeneTodos.map(t => new Todo(t));

        this.saveToLocalStorage(mappedTodos);
        this.allTodosPool.set(mappedTodos);
        return mappedTodos;
      }),
      catchError(() => {
        this.allTodosPool.set(echteTodoObjekte);
        return of(echteTodoObjekte);
      })
    );
  }

  /**
   * ➕ TODO ERSTELLEN
   */
  public createTodo(todo: Todo, aktuelleListe: Todo[]): Observable<Todo[]> {
    if (this.connectionService.status() === 'OFFLINE') {
      todo.syncState = 'new'; // Für die UI
      const neueListe = [...aktuelleListe, todo].map(t => new Todo(t));
      this.saveToLocalStorage(neueListe);

      // 🏷️ Ab in die Bulk-Queue!
      this.updateBulkQueue(todo, 'CREATED');

      this.allTodosPool.set(neueListe);
      return of(neueListe);
    }
    return this.todoRepository.createTodo(todo).pipe(
      map(savedTodo => {
        savedTodo.syncState = 'fine';
        const neueListe = [...aktuelleListe, savedTodo].map(t => new Todo(t));
        this.saveToLocalStorage(neueListe);

        // 💡 HIER! Signal online aktualisieren
        this.allTodosPool.set(neueListe);
        return neueListe;
      })
    );
  }

  /**
   * ❌ TODO LÖSCHEN
   */
  // 🗑️ Einzelnes To-Do löschen
  public deleteTodo(id: string): Observable<void> {
    const currentTodos = this.allTodosPool();
    const todoToDelete = currentTodos.find(t => t.id === id);

    if (this.connectionService.status() === 'OFFLINE') {
      if (todoToDelete) {
        // 🏷️ Ab in die Bulk-Queue mit dem Löschbefehl!
        this.updateBulkQueue(todoToDelete, 'DELETED');

        // Aus dem UI-Pool filtern, damit es sofort verschwindet
        const gefilterteListe = currentTodos.filter(t => t.id !== id);
        this.saveToLocalStorage(gefilterteListe);
        this.allTodosPool.set(gefilterteListe);
      }
      return of(void 0); // Erfolgreich lokal gelöscht!
    }

    // Online-Modus bleibt unverändert...
    return this.todoRepository.deleteTodo(id).pipe(
      tap(() => {
        const gefilterteListe = this.allTodosPool().filter(t => t.id !== id);
        this.saveToLocalStorage(gefilterteListe);
        this.allTodosPool.set(gefilterteListe);
      })
    );
  }
  /**
   * 📝 TODO BEARBEITEN
   */
  /**
     * 📝 TODO BEARBEITEN (Hauptmethode - Jetzt übersichtlich strukturiert)
     */
  public updateTodo(updatedTodo: Todo, currentList: Todo[]): Observable<Todo[]> {
    if (this.connectionService.status() === 'OFFLINE') {
      return this.processOfflineUpdate(updatedTodo, currentList);
    }

    return this.processOnlineUpdate(updatedTodo, currentList);
  }

  /** 🔴 Verarbeitet die Änderung rein lokal im Offline-Modus */
  private processOfflineUpdate(updatedTodo: Todo, currentList: Todo[]): Observable<Todo[]> {
    const originalTodo = currentList.find(t => t.id === updatedTodo.id);
    if (originalTodo && Number(originalTodo.effort) !== Number(updatedTodo.effort)) {
      return throwError(() => new Error('Effort estimations cannot be changed while offline!'));
    }

    const updatedOfflineList = currentList.map(todo => {
      if (todo.id === updatedTodo.id) {
        updatedTodo.syncState = updatedTodo.syncState === 'new' ? 'new' : 'dirty';

        // 🏷️ Ab in die Bulk-Queue!
        this.updateBulkQueue(updatedTodo, 'UPDATED');

        return new Todo(updatedTodo);
      }
      return new Todo(todo);
    });

    this.applyLocalStateUpdate(updatedOfflineList);
    return of(updatedOfflineList);
  }

  /** 🟢 Sendet die Änderung zum Server und verarbeitet die Antwort (inkl. Gamification) */
  private processOnlineUpdate(updatedTodo: Todo, currentList: Todo[]): Observable<Todo[]> {
    return this.todoRepository.updateTodo(updatedTodo).pipe(
      map((response: TodoUpdateResponse) => {
        const serverTodo = response.todo as unknown as Todo;
        serverTodo.syncState = 'fine';

        const finalUpdatedList = currentList.map(todo =>
          todo.id === serverTodo.id ? new Todo(serverTodo) : new Todo(todo)
        );

        // Gamification-Konfetti werfen 🎉
        if (response.gamificationResult) {
          this.userService.updateGamification(response.gamificationResult);
        }

        this.applyLocalStateUpdate(finalUpdatedList);
        return finalUpdatedList;
      }),
      catchError((err) => throwError(() => err))
    );
  }

  /** 💾 Aktualisiert synchron den LocalStorage und das reaktive Pool-Signal */
  private applyLocalStateUpdate(updatedList: Todo[]): void {
    this.saveToLocalStorage(updatedList);
    this.allTodosPool.set(updatedList);
  }

  // 🗑️ Erledigte private Aufgaben löschen (Footer links)
  public deleteCompleted(userId: string): Observable<void> {
    return this.todoRepository.deleteCompleted(userId).pipe(
      tap(() => {
        // Entfernt aus dem allTodosPool nur erledigte Aufgaben, die keinen Meilenstein haben
        const currentTodos = this.allTodosPool();
        const gefilterteListe = currentTodos.filter(t => !(t.done && !t.milestoneId));

        this.saveToLocalStorage(gefilterteListe);
        this.allTodosPool.set(gefilterteListe);
      })
    );
  }

  // 🗑️ Alle privaten Aufgaben löschen (Footer rechts)
  public deleteAll(userId: string): Observable<void> {
    return this.todoRepository.deleteAll(userId).pipe(
      tap(() => {
        // Behält im allTodosPool nur die Aufgaben, die zu einem Meilenstein gehören (Projekt-Aufgaben)
        const currentTodos = this.allTodosPool();
        const gefilterteListe = currentTodos.filter(t => t.milestoneId);

        this.saveToLocalStorage(gefilterteListe);
        this.allTodosPool.set(gefilterteListe);
      })
    );
  }

  private saveToLocalStorage(todos: Todo[]): void {
    this.localStorageService.setItem(this.CACHE_KEY, todos);
  }

  /**
 * 🧠 Holt die intelligenten Vorschläge. Prüft den Online-Status,
 * nutzt den Cache oder schlägt im absoluten Notfall Standard-Wörter vor.
 */
  public getQuickPredictions(modus: 'PAUSE' | 'ACTIVE'): Observable<string[]> {

    // Hilfsfunktion: Versucht den lokalen Cache zu lesen, sonst hartes Fallback
    const getOfflineOrFallbackStrings = (): string[] => {
      const cacheKey = modus === 'PAUSE' ? this.PREDICTIONS_PAUSE_KEY : this.PREDICTIONS_ACTIVE_KEY;
      const cachedData = this.localStorageService.getItem<string[]>(cacheKey);

      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      return modus === 'PAUSE' ? this.fallbackPauseTodos : this.fallbackActiveTodos;
    };

    // Szenario A: Wir sind nachweislich OFFLINE
    if (this.connectionService.status() === 'OFFLINE') {
      return of(getOfflineOrFallbackStrings());
    }

    // Szenario B: Wir sind ONLINE -> Server fragen und Cache updaten
    return this.todoRepository.getQuickPredictions(modus).pipe(
      map(predictions => {
        if (predictions && predictions.length > 0) {
          const cacheKey = modus === 'PAUSE' ? this.PREDICTIONS_PAUSE_KEY : this.PREDICTIONS_ACTIVE_KEY;
          this.localStorageService.setItem(cacheKey, predictions);
          return predictions;
        }
        return getOfflineOrFallbackStrings();
      }),
      // Falls der Request im Tunnel fehlschlägt oder ein Timeout fliegt
      catchError(() => of(getOfflineOrFallbackStrings()))
    );
  }

  private clearLocalStorage(): void {
    this.localStorageService.removeItem(this.CACHE_KEY);
    this.clearLocalOfflineStorage();
  }

  private getBulkQueueFromStorage(): TodoBulkDto[] {
    const data = localStorage.getItem(this.OFFLINE_CHANGES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveBulkQueueToStorage(queue: TodoBulkDto[]): void {
    localStorage.setItem(this.OFFLINE_CHANGES_KEY, JSON.stringify(queue));
  }

  private updateBulkQueue(todo: Todo, action: 'CREATED' | 'UPDATED' | 'DELETED'): void {
    let queue = this.getBulkQueueFromStorage();
    const existingIndex = queue.findIndex(q => q.id === todo.id);

    // Das DTO-Paket schnüren
    const bulkItem: TodoBulkDto = {
      ...todo,
      syncAction: action
    };

    if (existingIndex > -1) {
      const previousAction = queue[existingIndex].syncAction;

      if (action === 'DELETED') {
        if (previousAction === 'CREATED') {
          // Fall A: Offline erstellt UND offline gelöscht
          queue[existingIndex] = { ...bulkItem, syncAction: 'CREATED_AND_DELETED' };
        } else if (previousAction === 'UPDATED' || previousAction === 'DIRTY_AND_DELETED') {
          // Fall B: Auf Server bekannt, offline geändert UND danach gelöscht!
          queue[existingIndex] = { ...bulkItem, syncAction: 'DIRTY_AND_DELETED' };
        } else {
          queue[existingIndex] = bulkItem;
        }
      } else if (action === 'UPDATED') {
        if (previousAction === 'CREATED' || previousAction === 'CREATED_AND_DELETED') {
          // Bleibt ein neues Todo, kriegt nur die neuesten Werte
          queue[existingIndex] = { ...bulkItem, syncAction: previousAction };
        } else {
          queue[existingIndex] = bulkItem;
        }
      } else {
        queue[existingIndex] = bulkItem;
      }
    } else {
      // Noch nicht in der Queue? Einfach reinschreiben!
      queue.push(bulkItem);
    }

    this.saveBulkQueueToStorage(queue);
  }

  public resetData(): void {
    this.allTodosPool.set([]);
    this.clearLocalStorage();
    this.localStorageService.removeItem(this.PREDICTIONS_ACTIVE_KEY)
    this.localStorageService.removeItem(this.PREDICTIONS_PAUSE_KEY)
  }

  public override checkUnsavedData(): string | null {
    let queue = this.getBulkQueueFromStorage();
    if (queue && queue.length > 0) {
      return `Es gibt ${queue.length} ungespeicherte To-Dos oder Änderungen, die noch nicht mit dem Server synchronisiert wurden.`;
    }
    return null
  }
}