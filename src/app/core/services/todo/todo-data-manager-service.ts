import { Inject, Injectable, effect, inject, signal } from '@angular/core';
import { Todo } from '../../models/todo';
import { TodoRepository } from '../../repositories/todo-repository';
import { ConnectionService } from '../connection/connection-service';
import { combineLatest, Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap, filter } from 'rxjs/operators'; // 💡 tap importiert!
import { GamificationResult } from '../../models/gamification';
import { SyncResult } from '../../repositories/dto/sync-result';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { TodoUpdateResponse } from '../../repositories/dto/dto-interface';
import { TodoBulkDto } from '../../models/todo-bulk';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { StreakInfoDto } from '../../models/streak.info-dto';
import { toObservable } from '@angular/core/rxjs-interop';
import { StreakRepository } from '../../repositories/streak-repository';

@Injectable({
  providedIn: 'root'
})
export class TodoDataManagerService extends BaseDataManager {
  private todoRepository = inject(TodoRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService)
  private streakRepository = inject(StreakRepository)

  private readonly CACHE_KEY = 'global_todos_pool';
  private readonly OFFLINE_CHANGES_KEY = 'offline_todos_queue';
  private readonly PREDICTIONS_ACTIVE_KEY = 'cached_predictions_active';
  private readonly PREDICTIONS_PAUSE_KEY = 'cached_predictions_pause';

  // 2. Die ultimativen Notfall-Fallbacks (wenn der Cache komplett leer ist)
  private readonly fallbackPauseTodos = ['Kaffee trinken', 'Dehnen', 'Wasser holen', 'Kurz lüften'];
  private readonly fallbackActiveTodos = ['Refactoring UI', 'Bugfix Service', 'Code Review', 'Doku schreiben'];

  public allTodosPool = signal<Todo[]>([]);

  public gamificationSignal = signal<GamificationResult | null>(null);
  public streakSignal = signal<StreakInfoDto | null>(null);
  public syncCompleted = signal<SyncResult | null>(null);

  constructor() {
    super()
    effect(() => {
      const status = this.connectionService.status();
      if (status === 'UNKNOWN') return;

      if (status === 'ONLINE') {
        const currentUser = this.userService.currentUser();
        if (!currentUser || !this.userService.isLoggedIn()) return;
        this.triggerBulkSync(currentUser.id);
      }
    });

    combineLatest([
      toObservable(this.userService.currentUser),     // Lauscht auf Logins / Session-Wiederherstellungen[cite: 2, 6]
      toObservable(this.connectionService.status)     // Lauscht auf den Netzwerk-Status[cite: 3, 6]
    ]).pipe(
      // Nur triggern, wenn wir einen gültigen User HABEN und das Internet definitiv ONLINE ist
      filter(([user, status]) => user !== null && status === 'ONLINE'),
      
      // switchMap bricht bei Internet-Flackern alle alten HTTP-Anfragen automatisch ab!
      switchMap(([user, _]) => {
        console.log(`🔋 [DataManager-Streak] Starte sicheren Initial-Sync für User ${user!.id}...`);
        return this.streakRepository.syncAndGetStreakInfo(user!.id);
      })
    ).subscribe({
      next: (streakInfo) => {
        console.log('🔋 [DataManager-Streak] Batterie erfolgreich initialisiert:', streakInfo);
        
        // 🔥 Hier befüllen wir das Signal direkt an der Quelle!
        this.streakSignal.set(streakInfo); 
      },
      error: (err) => {
        console.error('🔋 [DataManager-Streak] Fehler beim Laden der Batterie:', err);
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
        // Pool mit der vom Server korrigierten (und um Projekt-Todos ergänzten) Liste befüllen
        this.allTodosPool.set(result.liste.map(t => new Todo(t)));
        this.syncCompleted.set(result);
        if (result.streakInfo) {
          this.streakSignal.set(result.streakInfo); // 🔥 NEU: Setzen bei Bulk-Sync
        }

        // Wenn alles erfolgreich war: Die Offline-Warteschlange leeren!
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
   * TODO BEARBEITEN
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
        const serverTodo = response.todo;
        serverTodo.syncState = 'fine';

        const finalUpdatedList = currentList.map(todo =>
          todo.id === serverTodo.id ? new Todo(serverTodo) : new Todo(todo)
        );

        // Gamification-Konfetti werfen 🎉
        if (response.gamificationResult) {
          this.userService.updateGamification(response.gamificationResult);
        }

        if (response.streakInfo) {
           this.streakSignal.set(response.streakInfo); 
        }

        this.applyLocalStateUpdate(finalUpdatedList);
        return finalUpdatedList;
      }),
      catchError((err) => throwError(() => err))
    );
  }

  /**Aktualisiert synchron den LocalStorage und das reaktive Pool-Signal */
  private applyLocalStateUpdate(updatedList: Todo[]): void {
    this.saveToLocalStorage(updatedList);
    this.allTodosPool.set(updatedList);
  }

  // Erledigte private Aufgaben löschen (Footer links)
  public deleteCompleted(userId: string): Observable<void> {
    const currentTodos = this.allTodosPool();
    // Lokale UI-Filterung: Entferne erledigte Aufgaben ohne Meilenstein
    const gefilterteListe = currentTodos.filter(t => !(t.done && !t.milestoneId));

    this.saveToLocalStorage(gefilterteListe);
    this.allTodosPool.set(gefilterteListe);

    if (this.connectionService.status() === 'OFFLINE') {
      // 🏷️ Reihenfolge-sicher in die Queue schieben!
      this.pushActionToBulkQueue({
        syncAction: 'BULK_DELETE_COMPLETED',
        timestamp: Date.now()
      });
      return of(void 0);
    }

    return this.todoRepository.deleteCompleted(userId).pipe(
      catchError(() => {
        // Fallback: Falls der Request im Tunnel abschmiert, ab in die Queue!
        this.pushActionToBulkQueue({
          syncAction: 'BULK_DELETE_COMPLETED',
          timestamp: Date.now()
        });
        return of(void 0);
      })
    );
  }

  // 🗑️ Alle privaten Aufgaben löschen (Footer rechts)
  public deleteAll(userId: string): Observable<void> {
    const currentTodos = this.allTodosPool();
    // Lokale UI-Filterung: Behalte nur Aufgaben mit Meilenstein
    const gefilterteListe = currentTodos.filter(t => t.milestoneId);

    this.saveToLocalStorage(gefilterteListe);
    this.allTodosPool.set(gefilterteListe);

    if (this.connectionService.status() === 'OFFLINE') {
      // 🏷️ Reihenfolge-sicher in die Queue schieben!
      this.pushActionToBulkQueue({
        syncAction: 'BULK_DELETE_ALL',
        timestamp: Date.now()
      });
      return of(void 0);
    }

    return this.todoRepository.deleteAll(userId).pipe(
      catchError(() => {
        this.pushActionToBulkQueue({
          syncAction: 'BULK_DELETE_ALL',
          timestamp: Date.now()
        });
        return of(void 0);
      })
    );
  }

  /**
   * ⏱️ DER REIHENFOLGE-SAFEGUARD: Schiebt Aktionen streng chronologisch in den Speicher
   */
  private pushActionToBulkQueue(actionItem: TodoBulkDto): void {
    let queue = this.getBulkQueueFromStorage();

    // Für normale CRUD-Operationen optimieren wir die Queue weiterhin,
    // aber wir behalten die strikte Append-Reihenfolge für Massenoperationen bei.
    if (actionItem.id) {
      const existingIndex = queue.findIndex(q => q.id === actionItem.id && !q.syncAction.startsWith('BULK_'));

      if (existingIndex > -1) {
        const previousAction = queue[existingIndex].syncAction;
        if (actionItem.syncAction === 'DELETED') {
          if (previousAction === 'CREATED') {
            queue[existingIndex].syncAction = 'CREATED_AND_DELETED';
          } else if (previousAction === 'UPDATED' || previousAction === 'DIRTY_AND_DELETED') {
            queue[existingIndex].syncAction = 'DIRTY_AND_DELETED';
          } else {
            queue[existingIndex] = actionItem;
          }
        } else if (actionItem.syncAction === 'UPDATED') {
          if (previousAction === 'CREATED' || previousAction === 'CREATED_AND_DELETED') {
            queue[existingIndex] = { ...actionItem, syncAction: previousAction };
          } else {
            queue[existingIndex] = actionItem;
          }
        } else {
          queue[existingIndex] = actionItem;
        }
        this.saveBulkQueueToStorage(queue);
        return;
      }
    }

    // Wenn es ein Massenlöschen ist oder das Item neu ist -> Hinten anreihen!
    queue.push(actionItem);
    this.saveBulkQueueToStorage(queue);
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

  // Diese Hilfsmethode leitet bestehende CRUD-Aufrufe an unseren neuen Safeguard weiter
  private updateBulkQueue(todo: Todo, action: 'CREATED' | 'UPDATED' | 'DELETED'): void {
    this.pushActionToBulkQueue({
      ...todo,
      id: todo.id,
      syncAction: action,
      timestamp: Date.now()
    });
  }

  public resetData(): void {
    this.allTodosPool.set([]);
    this.clearLocalStorage();
    this.localStorageService.removeItem(this.PREDICTIONS_ACTIVE_KEY)
    this.localStorageService.removeItem(this.PREDICTIONS_PAUSE_KEY)
    this.streakSignal.set(null);
  }

  public override checkUnsavedData(): string | null {
    let queue = this.getBulkQueueFromStorage();
    if (queue && queue.length > 0) {
      return `Es gibt ${queue.length} ungespeicherte To-Dos oder Änderungen, die noch nicht mit dem Server synchronisiert wurden.`;
    }
    return null
  }
}