import { inject, Injectable } from '@angular/core';
import { TeamStatus, Todo } from '../models/todo';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { GamificationResult, TodoStatusUpdatePayload } from '../models/gamification';
import { aiCategoriesApiUrl, bulkApiUrl, gamificationApiUrl, todoApiUrl } from './links';
import { SyncResult } from './dto/sync-result';
import { LoggerService } from '../services/logger/logger-service';
import { TodoUpdateResponse } from './dto/dto-interface';
import { ITodoJSON } from './dto/todo-json';
import { TodoBulkDto } from '../models/todo-bulk';


@Injectable({
  providedIn: 'root',
})
export class TodoRepository {
  private loggerService = inject(LoggerService)

  constructor(private http: HttpClient) { }

  // 📥 Alle To-Dos für diesen User-Namen/ID laden
  getTodos(userId: string | null): Observable<Todo[]> {
    console.log("TodoRepository: getTodos")
    let params = new HttpParams()
    if (userId) {
      params = new HttpParams().set('userId', userId);
    }
    const result = this.http.get<ITodoJSON[]>(todoApiUrl, { params }).pipe(
      map(jsonArray => jsonArray.map(json => this.mapToTodoClass(json)))
    );
    console.log("server antwortet for getTodos:", result)
    return result
  }

  // 📤 Neues To-Do senden (enthält im Body bereits die userId)
  createTodo(todo: Todo): Observable<Todo> {
    return this.http.post<ITodoJSON>(todoApiUrl, todo).pipe(
      map(json => this.mapToTodoClass(json))
    );
  }

  public updateTodo(todo: Todo): Observable<TodoUpdateResponse> {
    console.log("TodoRepository:: updateTodo", todo);

    // 🌟 Wir typisieren den HTTP-Aufruf mit unserem neuen Interface!
    return this.http.put<TodoUpdateResponse>(`${todoApiUrl}/${todo.id}`, todo).pipe(
      map(responseBody => {
        // Wir nutzen deine bewährte Hilfsmethode, um das rohe JSON wieder in die echte Klasse zu mappen
        const mappedTodo = this.mapToTodoClass(responseBody.todo);
        console.log("TodoRepository::update Todo result responseBody: ", responseBody)
        // Wir geben das Paket sauber strukturiert und voll typisiert an die nächste Schicht weiter
        const result = {
          todo: mappedTodo as any, // Cast, da mapToTodoClass die voll funktionsfähige Klasse zurückgibt
          gamificationResult: responseBody.gamificationResult,
          streakInfo: responseBody.streakInfo
        };
        console.log("TodoRepository::update Todo result: ", result)
        return result
      })
    );
  }
  
// 🗑️ 1. Einzelnes To-Do über den Mülleimer löschen
  // Geht an: DELETE /api/todos/{id}
  deleteTodo(id: string): Observable<void> {
    return this.http.delete<void>(`${todoApiUrl}/${id}`);
  }

  // 🗑️ 2. Erledigte private Aufgaben löschen (Footer links)
  // Geht an: POST /api/todos/completed?userId=xyz
  deleteCompleted(userId: string): Observable<void> {
    const params = new HttpParams().set('userId', userId);
    // WICHTIG: POST benötigt einen Body als 2. Parameter (den wir leer/null lassen). 
    // Die params übergeben wir im Konfigurationsobjekt als 3. Parameter!
    return this.http.post<void>(`${todoApiUrl}/completed`, null, { params });
  }

  // 🗑️ 3. Alle privaten Aufgaben löschen (Footer rechts)
  // Geht an: POST /api/todos/all?userId=xyz
  deleteAll(userId: string): Observable<void> {
    const params = new HttpParams().set('userId', userId);
    return this.http.post<void>(`${todoApiUrl}/all`, null, { params });
  }

  private mapToTodoClass(json: ITodoJSON): Todo {
    return Todo.fromJson(json);
  }
  
  /**
   * 🔄 Schickt alle Offline-Änderungen gesammelt ans Kotlin-Backend
   */
  public syncBulkTodos(userId: string, offlineTodos: TodoBulkDto[]): Observable<SyncResult> {
    // Wichtig: userId wird als Query-Param (?userId=...) übergeben, die Liste als JSON-Body
    return this.http.post<SyncResult>(`${bulkApiUrl}?userId=${userId}`, offlineTodos).pipe(
      map((result: SyncResult) => {
        const mappedList = result.liste.map((json: any) => this.mapToTodoClass(json))
        return {
          gamificationResult: result.gamificationResult,
          liste: mappedList,
          streakInfo: result.streakInfo
        }
      })
    )
  }

  /**
   * 🔮 KI-Vorschlag vom Server holen
   */
  public getAiCategorySuggestion(text: string, userId: string): Observable<{ suggestedCategory: string }> {
    this.loggerService.info("in todoRepository", "gtAiCategorySuggestion")
    const result = this.http.get<{ suggestedCategory: string }>(
      `${todoApiUrl}/predict?text=${encodeURIComponent(text)}&userId=${userId}`
    );
    this.loggerService.info("in todoRepository", "gtAiCategorySuggestion result ist da")
    return result
  }

  /**
   * 📋 Alle Kategorien vom Server holen (Dynamisch aus der Server-KI)
   */
  public getServerCategories(userId: string): Observable<string[]> {
    this.loggerService.info("in todoRepository", "getServerCategories über KI-Endpoint");

    // 🎯 Fix: Wir nutzen aiCategoriesApiUrl (/api/ai/categories) statt todoApiUrl
    // 🎯 Fix: Wir übergeben 'contextType=todo' anstelle von userId, wie vom AIController gefordert!
    const result = this.http.get<string[]>(`${aiCategoriesApiUrl}?contextType=todo`);

    this.loggerService.info("in todoRepository", "getServerCategories KI-Antwort erhalten");
    return result;
  }

  /**
 * 📋 Holt die für den User relevanten Todos (Projekt + Privat) inkl. Zeitfenster-Filter
 */
  public getRelevantTodos(userId: string, daysLookback: number = 30): Observable<Todo[]> {
    const params = new HttpParams()
      .set('userId', userId)
      .set('daysLookback', daysLookback.toString());

    return this.http.get<ITodoJSON[]>(`${todoApiUrl}/relevant`, { params }).pipe(
      map(jsonArray => jsonArray.map(json => this.mapToTodoClass(json)))
    );
  }

  /**
 * 🧠 Holt die KI-generierten Quick-Panel-Vorschläge vom Server
 */
  public getQuickPredictions(modus: 'PAUSE' | 'ACTIVE'): Observable<string[]> {
    const params = new HttpParams().set('modus', modus);
    return this.http.get<string[]>(`${todoApiUrl}/quick-predictions`, { params });
  }
}  
