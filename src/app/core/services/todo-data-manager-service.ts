import { Inject, Injectable, effect, inject, signal } from '@angular/core';
import { Todo } from '../models/todo';
import { TodoRepository } from '../repositories/todo-repository';
import { ConnectionService } from './connection-service';
import { LocalStorageService } from './local-storage-service';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators'; // 💡 tap importiert!
import { GamificationResult } from '../models/gamification';
import { SyncResult } from '../repositories/dto/sync-result';
import { UserService } from './user/user-service';
import { LoggerService } from './logger-service';
import { TodoUpdateResponse } from '../repositories/dto/dto-interface';

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
  public loadTodos(): Observable<Todo[]> {
    const cachedJSON = this.localStorageService.getItem<any[]>(this.CACHE_KEY) || [];
    let echteTodoObjekte: Todo[] = [];
    try {
      echteTodoObjekte = cachedJSON.map((t) => new Todo(t));
    } catch (e) {
      console.error('Fehler beim Instanziieren:', e);
    }

    if (this.connectionService.status() === 'OFFLINE') {
      // 💡 HIER! Wenn offline, befüllen wir das Signal sofort aus dem Cache
      this.allTodosPool.set(echteTodoObjekte);
      return of(echteTodoObjekte);
    }

    return this.todoRepository.getTodos(null).pipe(
      map(serverTodos => {
        const geladeneTodos = serverTodos && serverTodos.length > 0 ? serverTodos : echteTodoObjekte;
        const mappedTodos = geladeneTodos.map(t => new Todo(t));
        
        this.saveToLocalStorage(mappedTodos);
        
        // 💡 HIER! Sobald die Daten vom Server (oder Cache) da sind, schreiben wir sie ins Signal!
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
  public deleteTodo(id: string, aktuelleListe: Todo[], userId: string): Observable<Todo[]> {
    const gefilterteListe = aktuelleListe.filter(t => t.id !== id).map(t => new Todo(t));

    if (this.connectionService.status() === 'OFFLINE') {
      return throwError(() => new Error('Löschen ist im Offline-Modus nicht erlaubt!'));
    }

    return this.todoRepository.deleteTodo(id).pipe(
      map(() => {
        this.saveToLocalStorage(gefilterteListe);
        
        // 💡 HIER! Signal nach dem Löschen aktualisieren
        this.allTodosPool.set(gefilterteListe);
        return gefilterteListe;
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

  /**
   * TODOS LÖSCHEN (BULK)
   */
  public deleteTodosBulk(deletedTodos: Todo[], actualList: Todo[]): Observable<Todo[]> {
    if (deletedTodos.length === 0) return of([]);
    
    const deletedMap = deletedTodos.map(t => t.id)
    const filtered = actualList.filter(t => !deletedMap.includes(t.id)).map(t => new Todo(t));

    if (this.connectionService.status() === 'OFFLINE') {
      this.saveToLocalStorage(filtered);
      // 💡 HIER! Signal bei Bulk-Delete offline aktualisieren
      this.allTodosPool.set(filtered);
      return of(filtered);
    }

    return this.todoRepository.deleteBulk(deletedMap).pipe(
      map(() => {
        this.saveToLocalStorage(filtered);
        // 💡 HIER! Signal bei Bulk-Delete online aktualisieren
        this.allTodosPool.set(filtered);
        return filtered
      })
    );
  }

  private saveToLocalStorage(todos: Todo[]): void {
    this.localStorageService.setItem(this.CACHE_KEY, todos);
  }
}