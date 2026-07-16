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

@Injectable({
  providedIn: 'root'
})
export class TodoDataManagerService {
  private todoRepository = inject(TodoRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService)
  private localStorageService = inject(LocalStorageService);

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
    const offlineTodos = this.getOfflineTodosFromStorage();
    if (!offlineTodos || offlineTodos.length === 0) return;

    this.todoRepository.syncBulkTodos(userId, offlineTodos).subscribe({
      next: (result) => {
        this.syncCompleted.set(result);
        // 💡 HIER! Wenn der Groß-Sync durch ist, befüllen wir den Pool mit der neuen Liste
        this.allTodosPool.set(result.liste.map(t => new Todo(t)));
        return this.clearLocalOfflineStorage();
      }
    });
  }

  private getOfflineTodosFromStorage(): Todo[] {
    const data = localStorage.getItem(this.OFFLINE_CHANGES_KEY);
    return data ? JSON.parse(data) : [];
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
      todo.syncState = 'new';
      const neueListe = [...aktuelleListe, todo].map(t => new Todo(t));
      this.saveToLocalStorage(neueListe);

      // 💡 HIER! Signal offline aktualisieren
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
    if (this.connectionService.status() === 'OFFLINE') {
      return throwError(() => new Error('Löschen ist im Offline-Modus nicht erlaubt!'));
    }

    return this.todoRepository.deleteTodo(id).pipe(
      tap(() => {
        // Nutzt dein echtes allTodosPool-Signal!
        const currentTodos = this.allTodosPool();
        const gefilterteListe = currentTodos.filter(t => t.id !== id);
        
        this.saveToLocalStorage(gefilterteListe);
        this.allTodosPool.set(gefilterteListe);
      })
    );
  }
  
  /**
   * 📝 TODO BEARBEITEN
   */
  public updateTodo(updatedTodo: Todo, currentList: Todo[]): Observable<Todo[]> {
    if (this.connectionService.status() === 'OFFLINE') {
      const originalTodo = currentList.find(t => t.id === updatedTodo.id);
      if (originalTodo && Number(originalTodo.effort) !== Number(updatedTodo.effort)) {
        return throwError(() => new Error('Effort estimations cannot be changed while offline!'));
      }

      const updatedOfflineList = currentList.map(todo => {
        if (todo.id === updatedTodo.id) {
          updatedTodo.syncState = updatedTodo.syncState === 'new' ? 'new' : 'dirty';
          return new Todo(updatedTodo);
        }
        return new Todo(todo);
      });

      this.saveToLocalStorage(updatedOfflineList);

      // 💡 HIER! Signal offline bearbeiten
      this.allTodosPool.set(updatedOfflineList);
      return of(updatedOfflineList);
    }

    return this.todoRepository.updateTodo(updatedTodo).pipe(
      map((response: TodoUpdateResponse) => {
        const serverTodo = response.todo as unknown as Todo;
        serverTodo.syncState = 'fine';

        const finalUpdatedList = currentList.map(todo =>
          todo.id === serverTodo.id ? new Todo(serverTodo) : new Todo(todo)
        );

        if (response.gamificationResult) {
          this.userService.updateGamification(response.gamificationResult);
        }

        this.saveToLocalStorage(finalUpdatedList);

        // 💡 HIER! Signal online bearbeiten
        this.allTodosPool.set(finalUpdatedList);
        return finalUpdatedList;
      }),
      catchError((err) => throwError(() => err))
    );
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

}