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
  public readonly showPlannerModal = signal<boolean>(false);

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

  public closePlannerModal(): void {
     this.showPlannerModal.set(false) 
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
          console.log(mappedItems)
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
        reason: reject.reason
      }));

    // 3. Akzeptiertes Todo als Objekt aufbauen (inkl. optionalem Grund aus der UI, falls vorhanden)
    const acceptedTodoPayload = feedback.selectedTodoId 
      ? {
          todoId: feedback.selectedTodoId,
          reason: (feedback as any).selectedReason ?? null 
        }
      : null;

    // 4. Feedback in die Queue schieben
    this.plannerDataManager.queueFeedback(
      currentUserId,
      roundId,
      acceptedTodoPayload, 
      rejectedTodos
    );

    // 5. UI sofort zurücksetzen (Zero-Latency)
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

  /**
   * 🎯 Lädt Empfehlungen basierend auf der bewussten Gruppenwahl nach Task-Abschluss (BREAK, LIGHT, HEAVY)
   */
  public loadRecommendationsByGroup(desiredGroup: string): void {
    if (this.connectionService.isOffline()) {
      console.warn('⚡ [PlannerService] Gruppen-Empfehlungen können offline nicht geladen werden.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    // Hier rufen wir die AiRepository-Methode auf (die wir gleich noch kurz im Repository ergänzen)
    this.aiRepository
      .getGroupRecommendation(desiredGroup)
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

          this.showPlannerModal.set(true);
        },
        error: (err) => {
          console.error('Fehler beim Laden der Gruppen-Empfehlungen:', err);
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

  /**
   * 🛡 UI-TEST-SIMULATOR: Garantiert immer mindestens 2 unterschiedliche Karten 
   * für die Frontend-Entwicklung, falls die KI sich zu einig ist.
   */
  private ensureTwoDistinctRecommendation(items: RecommendedTodoItem[]): RecommendedTodoItem[] {
    if (items.length === 0) {
      // Fallback, wenn gar keine da sind
      return [
        {
          todo: new Todo({ task: '🚀 KI-Hauptvorschlag: Backend-Architektur aufräumen', effort: 3, category: 'Backend' }),
          plannerDetails: [{ plannerType: 'BAYES', reasonCode: 'Perfekt für deinen aktuellen Fokus.', score: 0.5 }],
          modeCode: 'STANDARD'
        },
        {
          todo: new Todo({ task: '💡 KI-Alternative: Dokumentation aktualisieren', effort: 2, category: 'Docs' }),
          plannerDetails: [{ plannerType: 'NEURAL', reasonCode: 'Schneller Quick-Win für zwischendurch.', score: 0.5  }],
          modeCode: 'STANDARD'
        }
      ];
    }

    const uniqueIds = new Set(items.map(i => i.todo.id));
    // Wenn nur 1 Vorschlag kommt oder beide exakt dieselbe ID haben:
    if (items.length === 1 || uniqueIds.size === 1) {
      const base = items[0];
      const clonedTodo = Todo.fromJson(base.todo.toJson());
      clonedTodo.id = base.todo.id + '-simulated-alt';
      clonedTodo.task = base.todo.task + ' (Alternative KI-Perspektive)';
      
      const secondItem: RecommendedTodoItem = {
        todo: clonedTodo,
        plannerDetails: [
          { plannerType: 'BAYES', reasonCode: 'Zweiter simulierter Vorschlag zur UI-Ansicht.', score: 1 }
        ],
        modeCode: base.modeCode
      };
      return [base, secondItem];
    }

    return items;
  }
}