import { inject, Injectable, signal } from '@angular/core';
import { UserService } from '../user/user-service';
import {
  AiRepository,
  PlannerRecommendationDetail,
  PlannerRecommendationsResponse,
  RejectedTodoFeedback
} from '../../repositories/ai-repository';
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

  public readonly activeRoundId = signal<string | null>(null);
  public readonly recommendations = signal<RecommendedTodoItem[]>([]);
  public readonly isLoading = signal<boolean>(false);
  public readonly showMorningModal = signal<boolean>(false);

  /**
   * Prüft, ob heute MORGENS ist und ob das Modal schon gezeigt wurde
   */
  public checkMorningState(): void {
    const now = new Date();
    const currentHour = now.getHours();
    const isMorningTime = currentHour >= 5 && currentHour < 12;
    const todayString = now.toISOString().split('T')[0];
    const lastShownDate = this.localStorageService.getItem('last_morning_greeting_date');

    // Wenn heute schon mal was angezeigt/registriert wurde, direkt raus
    if (lastShownDate === todayString) {
      return;
    }

    if (isMorningTime) {
      // FALL 1: Wir sind morgens, aber OFFLINE.
      // Wir können keine KI-Empfehlung laden, aber wir MÜSSEN den Tag 
      // im localStorage sperren, damit das Modal später am Tag nicht plötzlich aufspringt!
      if (this.connectionService.isOffline()) {
        this.localStorageService.setItem('last_morning_greeting_date', todayString);
        return;
      }

      // FALL 2: Wir sind morgens UND ONLINE. Alles perfekt -> Modal öffnen!
      this.showMorningModal.set(true);
    }
  }

  /**
   * Schließt das Modal und merkt sich, dass es heute schon da war
   */
  public dismissMorningModal(): void {
    const todayString = new Date().toISOString().split('T')[0];
    this.localStorageService.setItem('last_morning_greeting_date', todayString);
    this.showMorningModal.set(false);
  }

  /**
   * Lädt die Aufgabenempfehlungen der KI (Nur Online verfügbar)
   */
  public loadSmartRecommendation(energy: string, timeLeft: number): void {
    if (this.connectionService.isOffline()) {
      console.warn('⚡ [PlannerService] Empfehlungen können offline nicht geladen werden.');
      this.isLoading.set(false);
      return;
    }

    const currentUserId = this.userService.getCurrentUserId();
    this.isLoading.set(true);

    this.aiRepository
      .getPlannerRecommendation({
        userId: currentUserId ?? '',
        userEnergy: energy,
        workingTimeLeft: timeLeft
      })
      .subscribe({
        next: (response: PlannerRecommendationsResponse) => {
          this.activeRoundId.set(response.roundId);

          const mappedItems: RecommendedTodoItem[] = response.recommendations
            .filter((rec) => rec.todo !== null)
            .map((rec) => ({
              todo: Todo.fromJson(rec.todo!),
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
    const currentUserId = this.userService.getCurrentUserId() ?? '';
    const roundId = this.activeRoundId() ?? '';

    this.isLoading.set(true);

    // 1. Snooze-Aktionen sofort lokal ausführen & in Queue schieben
    feedback.rejections
      .filter((todo) => todo.reason === 'snooze')
      .forEach((it) => {
        this.snoozeRecommendedTodo(it.todoId, 30);
      });

    // 2. Ablehnungen filtern
    const rejectedTodos: RejectedTodoFeedback[] = feedback.rejections
      .filter((todo): todo is { todoId: string; reason: Exclude<RejectReason, 'snooze'> } => todo.reason !== 'snooze')
      .map((reject) => ({
        todoId: reject.todoId,
        rejectReason: reject.reason
      }));

    // 3. Feedback in die Queue schieben
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
  public snoozeRecommendedTodo(todoId: string, durationInMin: number): void {
    // 1. Sofort aus lokaler Ansicht entfernen
    this.recommendations.update((list) => list.filter((item) => item.todo.id !== todoId));

    // 2. Snooze in die Queue schieben
    this.plannerDataManager.queueSnooze(todoId, durationInMin);
  }

  /**
   * Abwärtskompatible Alias-Methode für bestehenden Code
   */
  public snoozyrecommendedTodo(todoId: string, durationInMin: number): void {
    this.snoozeRecommendedTodo(todoId, durationInMin);
  }

  /**
   * ☕ Lädt die morgendliche Top-Empfehlung (Nutzer wird über das Backend-Principal erkannt)
   */
  public loadMorningRecommendation(): void {
    if (this.connectionService.isOffline()) {
      console.warn('⚡ [PlannerService] Morgendliche Empfehlungen können offline nicht geladen werden.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    this.aiRepository
      .getMorningRecommendation()
      .subscribe({
        next: (response: PlannerRecommendationsResponse) => {
          this.activeRoundId.set(response.roundId);

          const mappedItems: RecommendedTodoItem[] = response.recommendations
            .filter((rec) => rec.todo !== null)
            .map((rec) => ({
              todo: Todo.fromJson(rec.todo!),
              plannerDetails: rec.plannerDetails,
              modeCode: rec.modeCode
            }));

          this.recommendations.set(mappedItems);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Fehler beim Laden der morgendlichen KI-Empfehlung:', err);
          this.isLoading.set(false);
        }
      });
  }

  public override resetData(): void {
    this.recommendations.set([]);
    this.activeRoundId.set(null);
    this.isLoading.set(false);
    this.localStorageService.removeItem('last_morning_greeting_date');
  }

  public clearRecommendations(): void {
    this.resetData();
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}