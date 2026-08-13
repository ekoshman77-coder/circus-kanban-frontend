import { inject, Injectable, signal } from '@angular/core';
import { UserService } from '../user/user-service';
import { AiRepository, PlannerRecommendationsResponse, RejectedTodoFeedback } from '../../repositories/ai-repository'; 
import { Todo } from '../../models/todo';
import { delay, Observable, tap } from 'rxjs';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { RecommendationResult, RejectReason } from '../../models/recommendation-result';

export interface RecommendedTodoItem {
  todo: Todo;
  plannerType: 'BAYES' | 'NEURAL' | null;
  modeCode: 'STANDARD' | 'RECHERCHE' | 'CLEAN_SLATE';
  reasonCode: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlannerService extends BaseDataManager {
  private userService = inject(UserService);
  private aiRepository = inject(AiRepository);

  /** Signal für die Runden-ID der aktuellen Empfehlungen */
  public activeRoundId = signal<string | null>(null);

  /** Signal für die Liste der empfohlenen To-Dos (max. 2) */
  public recommendations = signal<RecommendedTodoItem[]>([]);
  
  /** Signal für den Ladezustand */
  public isLoading = signal<boolean>(false);

  /**
   * Lädt die 2 Aufgabenempfehlungen basierend auf Energie und Arbeitszeit
   */
  public loadSmartRecommendation(energy: string, timeLeft: number): void { 
    console.log("PlannerService:: Start loading recommendation")
    const currentUserId = this.userService.getCurrentUserId();
    this.isLoading.set(true);
    this.aiRepository.getPlannerRecommendation({
      userId: currentUserId ?? "",
      userEnergy: 'MEDIUM', // z. B. 'HIGH'
      workingTimeLeft: timeLeft 
    })
    .subscribe({
      next: (response: PlannerRecommendationsResponse) => {
        console.log("PlannerService:: recommendation response", response)
 
        this.activeRoundId.set(response.roundId);

        // Mappe alle Server-Vorschläge in Domain-Objekte
        const mappedItems: RecommendedTodoItem[] = response.recommendations
          .filter(rec => rec.todo !== null)
          .map(rec => ({
            todo: new Todo(rec.todo!),
            plannerType: rec.plannerType,
            modeCode: rec.modeCode,
            reasonCode: rec.reasonCode
          }));

        this.recommendations.set(mappedItems);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der KI-Empfehlungen:', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Sendet das Runden-Feedback
   */
  /**
   * Sendet das Runden-Feedback
   */
  public sendFeedback(feedback: RecommendationResult): Observable<void> {
    const currentUserId = this.userService.getCurrentUserId();
    const roundId = this.activeRoundId();

    if (!roundId) {
      console.warn('Keine aktive roundId vorhanden!');
    }

    this.isLoading.set(true);

    // 1. Snooze-Aktionen sofort ausführen (mit .subscribe(), damit der HTTP-Call rausgeht!)
    feedback.rejections
      .filter(todo => todo.reason === 'snooze')
      .forEach(it => {
        this.snoozyrecommendedTodo(it.todoId, 30).subscribe();
      });

    // 2. Echte Ablehnungen filtern & typsicher für das Backend mappen
    const rejectedTodos: RejectedTodoFeedback[] = feedback.rejections
      .filter((todo): todo is { todoId: string; reason: Exclude<RejectReason, 'snooze'> } => todo.reason !== 'snooze')
      .map(reject => ({
        todoId: reject.todoId,
        // TypeScript weiß jetzt durch das Type Guard oben, dass 'snooze' unmöglich ist!
        rejectReason: reject.reason
      }));

    // 3. Das KI-Feedback ans Backend senden
    return this.aiRepository.sendPlannerFeedback({ 
      userId: currentUserId ?? "",
      roundId: roundId ?? "",
      acceptedTodoId: feedback.selectedTodoId ?? null,
      rejectedTodos: rejectedTodos
    })
    .pipe(
      delay(800),
      tap({
        next: () => {
          console.log('🧠 Runden-Feedback erfolgreich gesendet!');
          // Ansicht zurücksetzen
          this.recommendations.set([]);
          this.activeRoundId.set(null);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Fehler beim Senden des Runden-Feedbacks:', err);
          this.isLoading.set(false);
        }
      })
    );
  }
  
  /**
   * Ein einzelnes Todo snoozen (entfernt es auch lokal aus den Vorschlägen)
   */
  public snoozyrecommendedTodo(todoId: string, durationInMin: number): Observable<void> {
    return this.aiRepository.snoozyTodo(todoId, durationInMin).pipe(
      tap({
        next: () => {
          console.log("Todo wurde erfolgreich gesnoozt");
          // Entferne das gesnoozte Todo direkt aus der lokalen Liste
          this.recommendations.update(list => list.filter(item => item.todo.id !== todoId));
        },
        error: (err) => console.error("Fehler beim Snoozen", err)
      })
    );
  }

  public override resetData(): void {
    this.recommendations.set([]);
    this.activeRoundId.set(null);
    this.isLoading.set(false);
  }

  public clearRecommendations() {
    this.resetData()
  }
}