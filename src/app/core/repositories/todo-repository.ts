import { inject, Injectable } from '@angular/core';
import { Todo } from '../models/todo';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { GamificationResult, TodoStatusUpdatePayload } from '../models/gamification';
import { bulkApiUrl, gamificationApiUrl, todoApiUrl } from './links';
import { SyncResult } from './dto/sync-result';
import { LoggerService } from '../services/logger-service';
import { TodoUpdateResponse } from './dto/dto-interface';
import { ITodoJSON } from './dto/todo-json';


@Injectable({
  providedIn: 'root',
})
export class TodoRepository {
  private loggerService = inject(LoggerService)

  constructor(private http: HttpClient) {}

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
          gamificationResult: responseBody.gamificationResult
        };
        console.log("TodoRepository::update Todo result: ", result)
        return result
      })
    );
  }
  
  deleteTodo(id: string): Observable<void> {
    return this.http.delete<void>(`${todoApiUrl}/${id}`);
  }

  deleteAll(userId: string): Observable<void> {
    const params = new HttpParams().set('userId', userId);
    return this.http.delete<void>(`${todoApiUrl}/all`, { params });
  }

  deleteCompleted(userId: string): Observable<void> {
    const params = new HttpParams().set('userId', userId);
    console.log("params", params)
    return this.http.delete<void>(`${todoApiUrl}/completed`, { params });
  }

  deleteBulk(ids: string[]): Observable<void> {
     return this.http.post<void>(`${todoApiUrl}/delete-bulk`, ids)
  }

  private mapToTodoClass(json: ITodoJSON): Todo {
    const todo = new Todo({
      task: json.task,
      description: json.description,
      effort: json.effort,
      dueDate: json.dueDate,
      userId: json.userId,
      usedEffort: json.usedEffort,
      createdAt: json.createdAt,
      id: json.id,
      done: json.done,
      completedAt: json.completedAt,
      category: json.category,
      effortChangesCount: json.effortChangesCount,
      milestoneId: json.milestoneId,
      isStarted: json.isStarted?? false,
      assignedUserId: json.assignedUserId?? null
    });  
    return todo;
  }

  /**
   * 🔄 Schickt alle Offline-Änderungen gesammelt ans Kotlin-Backend
   */
  public syncBulkTodos(userId: string, offlineTodos: Todo[]): Observable<SyncResult> {
    // Wichtig: userId wird als Query-Param (?userId=...) übergeben, die Liste als JSON-Body
    return this.http.post<SyncResult>(`${bulkApiUrl}?userId=${userId}`, offlineTodos).pipe(
      map((result) => {
        const mappedList = result.liste.map((json: any) => this.mapToTodoClass(json))
        return {
          gamificationResult: result.gamificationResult,
          liste: mappedList
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
    this.loggerService.info("in todoRepository", "getServerCategories")
    const result = this.http.get<string[]>(`${todoApiUrl}/categories?userId=${userId}`);
    
    this.loggerService.info("in todoRepository", "getServerCategories result ist da")  
    return result  
  }

}  
