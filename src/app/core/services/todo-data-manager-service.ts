import { Inject, Injectable, effect, inject, signal } from '@angular/core';
import { Todo } from '../models/todo';
import { TodoRepository } from '../repositories/todo-repository';
import { ConnectionService } from './connection-service';
import { LocalStorageService } from './local-storage-service';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
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

  public gamificationSignal = signal<GamificationResult | null>(null);
  public syncCompleted = signal<SyncResult | null>(null);
  private loggerService = Inject(LoggerService)

constructor() {
    /**
     * 👁️ DER WACHHUND:
     * Reagiert vollautomatisch, sobald das Connection-Signal seinen Wert ändert!
     */
    effect(() => {
      const status = this.connectionService.status(); 
      
      // 🛡️ Schutzschild: Kaltstart abfangen, solange der Ping läuft
      if (status === 'UNKNOWN') {
        return; 
      }

      const isOnline = status === 'ONLINE';

      if (isOnline) {
        
        // 🌟 3. DIE ECHTE USER-ID NUTZEN statt 'mein-test-user-123'!
        const currentUser = this.userService.currentUser(); 
        
        if (!currentUser) {
          return;
        }
        
        // Jetzt synchronisieren wir mit der echten ID aus der Session!
        this.triggerBulkSync(currentUser.id);
      } else {
      }
    });
  }

  /**
   * 🔄 Führt den eigentlichen Sync-Prozess gegen dein Kotlin-Backend aus
   */
private triggerBulkSync(userId: string): void {
    const offlineTodos = this.getOfflineTodosFromStorage();
    
    // 🛡️ SICHERHEITS-CHECK: Wenn keine Offline-Todos da sind, SOFORT abbrechen!
    // Wir loggen das, um im F12-Fenster genau zu sehen, was passiert.
    if (!offlineTodos || offlineTodos.length === 0) {
      return;
    }


    this.todoRepository.syncBulkTodos(userId, offlineTodos).subscribe({
      next: (result) => {
        this.syncCompleted.set(result);
        
        // Erst wenn der Server "Danke" gesagt hat, leeren wir den Offline-Speicher
        this.clearLocalOfflineStorage();
      },
      error: (err) => {
      }
    });
  }

  // --- Hilfsmethoden für deinen lokalen Offline-Speicher (musst du anpassen) ---
  private getOfflineTodosFromStorage(): Todo[] {
    // Beispielhaft aus dem LocalStorage ziehen
    const data = localStorage.getItem('offline_todos');
    return data ? JSON.parse(data) : [];
  }

  private clearLocalOfflineStorage(): void {
    localStorage.removeItem('offline_todos');
  }
  
  /**
   * CLEANUP-METHODE:
   * Hier gehört alles rein, was nach dem erfolgreichen Konsumieren 
   * im DataManager aufgeräumt werden muss!
   */
  public clearSyncResult(): void {
    console.log('🧹 DataManager räumt auf...');
    this.syncCompleted.set(null);
  }

  /**
   * 📋 DATEN LADEN (Kaltstart-sicher)
   */
public loadTodos(userId: string): Observable<Todo[]> {
    // 🪵 LOG 1: Start des Ladevorgangs

    const storageKey = `todos_${userId}`;
    const cachedJSON = this.localStorageService.getItem<any[]>(storageKey) || [];
    
    // 🪵 LOG 2: Zeigt die rohen Daten aus dem LocalStorage

    let echteTodoObjekte: Todo[] = [];
    try {
      echteTodoObjekte = cachedJSON.map((t, index) => {
        // Wir bauen das Objekt explizit für den Konstruktor zusammen
        const initParam = {
          id: t.id,
          task: t.task, 
          description: t.description, 
          effort: t.effort, 
          dueDate: t.dueDate, 
          userId: t.userId, 
          usedEffort: t.usedEffort, 
          createdAt: t.createdAt, 
          syncState: t.syncState, 
          done: t.done,
          completedAt: t.completedAt,
          category: t.category || 'Allgemein',
          isStarted: t.isStarted?? false
        };
        
        const todoKlasse = new Todo(initParam);
        
        // 🪵 LOG 3: Kontrolliert jedes einzelne gemappte To-Do
        return todoKlasse;
      });
    } catch (e) {
      console.error('❌ [DataManager] CRITICAL: Fehler beim Instanziieren der Todo-Klasse im Map-Prozess:', e);
    }

    // 🪵 LOG 4: Gesamtanzahl der lokal rekonstruierten Objekte

    const status = this.connectionService.status();

    if (status === 'OFFLINE') {
      return of(echteTodoObjekte);
    }

    return this.todoRepository.getTodos(userId).pipe(
      map(serverTodos => {
        
        // 🛡️ DER SCHUTZSCHILD: Nur überschreiben, wenn der Server wirklich Aufgaben liefert!
        if (serverTodos && serverTodos.length > 0) {
          this.saveToLocalStorage(userId, serverTodos);
          return serverTodos;
        } else {
          // 🎯 HIER RETTEN WIR DEINE AUFGABEN:
          // Wenn der Server 0 Todos schickt, werfen wir deine lokalen Daten nicht weg!
          return echteTodoObjekte; 
        }
      }),
      catchError((error) => {
        return of(echteTodoObjekte);
      })
    );
  }
  
  /**
   * ➕ TODO ERSTELLEN
   * Nutzt jetzt die zentrale Speicher-Logik!
   */
  public createTodo(todo: Todo, aktuelleListe: Todo[]): Observable<Todo[]> {
    const userId = todo.userId;

    if (this.connectionService.status() === 'OFFLINE') {
      todo.syncState = 'new';
      const neueListe = [...aktuelleListe, todo];
      
      // 💾 Direkt im LocalStorage sichern und neue Gesamtliste zurückgeben
      this.saveToLocalStorage(userId, neueListe);
      return of(neueListe);
    }

    return this.todoRepository.createTodo(todo).pipe(
      map(savedTodo => {
        savedTodo.syncState = 'fine';
        const neueListe = [...aktuelleListe, savedTodo];
        this.saveToLocalStorage(userId, neueListe);
        return neueListe;
      })
    );
  }
  
  /**
   * ❌ TODO LÖSCHEN
   */
  public deleteTodo(id: string, aktuelleListe: Todo[], userId: string): Observable<Todo[]> {
   const gefilterteListe = aktuelleListe.filter(t => t.id !== id);
   
   if (this.connectionService.status() === 'OFFLINE') {
      return throwError(() => new Error('Löschen ist im Offline-Modus nicht erlaubt!'));
    }

    return this.todoRepository.deleteTodo(id).pipe(
      map(() => {
        this.saveToLocalStorage(userId, gefilterteListe);
        return gefilterteListe;
      })
    );
  }

  /**
   * 📝 TODO BEARBEITEN - EFFORT ÄNDERUNG OFFLINE GESPERRT!
   */
public updateTodo(updatedTodo: Todo, currentList: Todo[], userId: string): Observable<Todo[]> {
//    this.loggerService.info("TodoDataManager", `Starting update pipeline for Todo ID: ${updatedTodo.id}`);

    // A: OFFLINE PATH
    if (this.connectionService.status() === 'OFFLINE') {
      // Offline blocking: Effort modifications are not allowed while offline
      const originalTodo = currentList.find(t => t.id === updatedTodo.id);
      if (originalTodo && Number(originalTodo.effort) !== Number(updatedTodo.effort)) {
        return throwError(() => new Error('Effort estimations cannot be changed while offline!'));
      }

      // Map the updated todo into our local list
      const updatedOfflineList = currentList.map(todo => {
        if (todo.id === updatedTodo.id) {
          // Keep 'new' if it wasn't synced yet, otherwise mark as 'dirty'
          updatedTodo.syncState = updatedTodo.syncState === 'new' ? 'new' : 'dirty';
          return updatedTodo;
        }
        return todo;
      });

      // Save the state locally in the browser
      this.saveToLocalStorage(userId, updatedOfflineList);
      return of(updatedOfflineList);
    }

    // B: ONLINE PATH
    return this.todoRepository.updateTodo(updatedTodo).pipe(
      map((response: TodoUpdateResponse) => { // 🌟 Strong typing with our new interface!
        
        // Extract the server-validated todo
        const serverTodo = response.todo as unknown as Todo;
        serverTodo.syncState = 'fine';
        
        // Update the current list with the final server state
        const finalUpdatedList = currentList.map(todo => todo.id === serverTodo.id ? serverTodo : todo);

        // GAMIFICATION PROCESS: If Kotlin calculated XP, trigger the user profile update!
        if (response.gamificationResult) {
          console.log("TodoDataManager", "Gamification XP received from server. Updating user profile.");
          this.userService.updateGamification(response.gamificationResult);
        }

        // Secure backup copy locally
        this.saveToLocalStorage(userId, finalUpdatedList);
        
        return finalUpdatedList; // Returns the clean, updated list to the TodoService
      }),
      catchError((err) => throwError(() => err))
    );
  }
   
  /**
   * 🧹 ERLEDIGTE TODOS LÖSCHEN
   */
  public deleteCompletedTodos(userId: string, aktuelleListe: Todo[]): Observable<Todo[]> {
    // Da wir die erledigten Todos löschen wollen, behalten wir nur die offenen (!t.done)
    const gefilterteListe = aktuelleListe.filter(t => !t.done);

    if (this.connectionService.status() === 'OFFLINE') {
      this.saveToLocalStorage(userId, gefilterteListe);
      return of(gefilterteListe);
    }

    // Online-Pfad: Löscht die fertigen Todos synchron auf der Datenbank
    return this.todoRepository.deleteCompleted(userId).pipe(
      map(() => {
        this.saveToLocalStorage(userId, gefilterteListe);
        return gefilterteListe;
      }),
      catchError((err) => throwError(() => err))
    );
  }
  

  /**
   * 🪣 ALLE TODOS LÖSCHEN (Komplettes Board leeren)
   */
  public deleteAllTodos(userId: string): Observable<Todo[]> {
    // A: OFFLINE-PFAD
    if (this.connectionService.status() === 'OFFLINE') {
      // Offline: Liste lokal sofort leeren und ein leeres Array zurückgeben
      this.saveToLocalStorage(userId, []);
      return of([]);
    }

    // B: ONLINE-PFAD
    // Ruft dein Repository auf, um alle Einträge dieses Users in der DB zu löschen
    return this.todoRepository.deleteAll(userId).pipe(
      map(() => {
        // Wenn der Server erfolgreich gelöscht hat, leeren wir auch das lokale Backup
        this.saveToLocalStorage(userId, []);
        return []; // Gibt das leere Array an den TodoService zurück
      }),
      catchError((err) => throwError(() => err))
    );
  }

  

  /**
   * 🛡️ Die zentrale Hilfsmethode für das Speichern (Deine "Execute"-Erweiterung)
   */
  private saveToLocalStorage(userId: string, todos: Todo[]): void {
    this.localStorageService.setItem(`todos_${userId}`, todos);
  }

  
}