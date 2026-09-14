import { inject, Injectable, signal } from '@angular/core';
import { UserService } from '../user/user-service';
import { AiRepository, PlannerRecommendationDetail, PlannerRecommendationsResponse, RejectedTodoFeedback } from '../../repositories/ai-repository';
import { Todo } from '../../models/todo';
import { ConnectionService } from '../connection/connection-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { RecommendationResult, RejectReason } from '../../models/recommendation-result';
import { PlannerDataManagerService } from './planner-data-manager-service';

export interface RecommendedTodoItem {
  todo: Todo;
  plannerDetails: PlannerRecommendationDetail[];
  modeCode: 'STANDARD' | 'ALL_SNOOZED';
}

@Injectable({
  providedIn: 'root'
})
export class PlannerService extends BaseDataManager {
  private userService = inject(UserService);
  private aiRepository = inject(AiRepository);
  private connectionService = inject(ConnectionService);
  private plannerDataManager = inject(PlannerDataManagerService);

  public activeRoundId = signal<string | null>(null);
  public recommendations = signal<RecommendedTodoItem[]>([]);
  public isLoading = signal<boolean>(false);

  /**
   * Lädt die 2 Aufgabenempfehlungen (Nur Online sinnvoll)
   */
  public loadSmartRecommendation(energy: string, timeLeft: number): void {
    if (this.connectionService.isOffline()) {
      console.warn('⚡ [PlannerService] Empfehlungen können offline nicht geladen werden.');
      this.isLoading.set(false);
      return;
    }

    const currentUserId = this.userService.getCurrentUserId();
    this.isLoading.set(true);

    this.aiRepository.getPlannerRecommendation({
      userId: currentUserId ?? "",
      userEnergy: energy,
      workingTimeLeft: timeLeft
    }).subscribe({
      next: (response: PlannerRecommendationsResponse) => {
        this.activeRoundId.set(response.roundId);

        const mappedItems: RecommendedTodoItem[] = response.recommendations
          .filter(rec => rec.todo !== null)
          .map(rec => ({
            todo: new Todo(rec.todo!),
            plannerDetails: rec.plannerDetails,
            modeCode: rec.modeCode
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
   * Sendet das Runden-Feedback (Optimistisch & Offline-Safe über DataManager)
   */
  public sendFeedback(feedback: RecommendationResult): void {
    const currentUserId = this.userService.getCurrentUserId() ?? "";
    const roundId = this.activeRoundId() ?? "";

    this.isLoading.set(true);

    // 1. Snooze-Aktionen sofort lokal ausführen & in Queue schieben
    feedback.rejections
      .filter(todo => todo.reason === 'snooze')
      .forEach(it => {
        this.snoozyrecommendedTodo(it.todoId, 30);
      });

    // 2. Ablehnungen filtern
    const rejectedTodos: RejectedTodoFeedback[] = feedback.rejections
      .filter((todo): todo is { todoId: string; reason: Exclude<RejectReason, 'snooze'> } => todo.reason !== 'snooze')
      .map(reject => ({
        todoId: reject.todoId,
        rejectReason: reject.reason
      }));

    // 3. Feedback in die Queue schieben (geht nie wieder verloren!)
    this.plannerDataManager.queueFeedback(
      currentUserId,
      roundId,
      feedback.selectedTodoId ?? null,
      rejectedTodos
    );

    // 4. UI sofort zurücksetzen (Zero-Latency)
    this.recommendations.set([]);
    this.activeRoundId.set(null);
    this.isLoading.set(false);
  }

  /**
   * Ein einzelnes Todo snoozen (Lokales UI-Update + Queue)
   */
  public snoozyrecommendedTodo(todoId: string, durationInMin: number): void {
    // 1. Sofort aus lokaler Ansicht entfernen
    this.recommendations.update(list => list.filter(item => item.todo.id !== todoId));

    // 2. Snooze in die Queue schieben
    this.plannerDataManager.queueSnooze(todoId, durationInMin);
  }

  public override resetData(): void {
    this.recommendations.set([]);
    this.activeRoundId.set(null);
    this.isLoading.set(false);
  }

  public clearRecommendations(): void {
    this.resetData();
  }
}