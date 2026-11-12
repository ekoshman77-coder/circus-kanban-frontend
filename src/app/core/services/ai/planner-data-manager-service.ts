import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { EmptyStateProvider } from '../central-queue/state-providers/empty-state-provider';
import { PlannerFeedbackPayload, PlannerQueueAction, RetrainPlannerPayload, SnoozePayload } from '../../models/queue-items/planner-queue-payload';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { AiRepository } from '../../repositories/ai-repository';
import { AcceptAction, RejectAction } from '../../models/recommendation-actions';

@Injectable({
  providedIn: 'root'
})
export class PlannerDataManagerService extends BaseQueueDataManager<EmptyStateProvider> {
  private aiRepository = inject(AiRepository);

  constructor() {
    super(QueueHandlerName.PLANNER);
  }

  protected override createStateProvider(): EmptyStateProvider {
    return new EmptyStateProvider();
  }

  // ==========================================
  // 🚀 QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as PlannerQueueAction;

    switch (action) {
      case 'SEND_FEEDBACK': {
        const payload = item.payload as PlannerFeedbackPayload;
        return this.aiRepository.sendPlannerFeedback(payload);
      }

      case 'SNOOZE_TODO': {
        const payload = item.payload as SnoozePayload;
        const duration = payload.durationInMin;
        const ageInMinutes = (Date.now() - item.timestamp) / 1000 / 60;

        if (ageInMinutes < duration) {
          return this.aiRepository.snoozyTodo(payload.id, duration);
        }
        return of(null);
      }

      case 'RETRAIN_AI': {
        // Ruft den POST-Endpunkt /api/ai/planner/train über das Repository auf
        return this.aiRepository.retrainAi();
      }

      default:
        return throwError((): Error => new Error(`[PlannerDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  // ==========================================
  // 🔄 REHYDRATION PATTERN
  // ==========================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return of(undefined);
  }

  // ==========================================
  // 📝 QUEUE AKTIONEN SCHIEBEN
  // ==========================================

  /**
   * 🎯 Schiebt ein explizites Runden-Feedback in die Queue (RoundId kommt direkt aus der UI-Aktion)
   */
/**
   * 🎯 Schiebt ein Runden-Feedback basierend auf unseren sauberen Actions in die Queue
   */
  public queueFeedback(
    userId: string,
    acceptAction: AcceptAction | null,
    rejectActions: RejectAction[]
  ): void {
    // Die roundId holen wir uns sicher direkt aus der jeweiligen Action
    const roundId = acceptAction?.roundId ?? rejectActions[0]?.roundId ?? '';

    const payload: PlannerFeedbackPayload = {
      id: roundId,
      userId,
      roundId,
      acceptedTodo: acceptAction 
        ? { todoId: acceptAction.todoId, reason: acceptAction.reason ?? null } 
        : null,
      rejectedTodos: rejectActions.map(r => ({
        todoId: r.todoId,
        reason: r.reason
      })),
      displayInfo: {
        category: 'KI-Planer',
        title: 'Feedback zur Aufgabenplanung'
      }
    };

    this.queueService.enqueue(this.serviceName, 'SEND_FEEDBACK', payload);
  }
  
  /**
   * 💤 Schiebt ein Snooze-Event unabhängig von Runden-IDs in die Queue
   */
  public queueSnooze(
    todoId: string, 
    durationInMin: number, 
    todoTitle?: string
  ): void {
    const payload: SnoozePayload = {
      id: todoId,
      durationInMin,
      displayInfo: {
        category: 'Aufgabe verschieben',
        title: todoTitle 
          ? `"${todoTitle}" (${durationInMin} Min.)` 
          : `Aufgabe für ${durationInMin} Min. pausieren`
      }
    };

    this.queueService.enqueue(this.serviceName, 'SNOOZE_TODO', payload);
  }

  /**
   * 🎓 Schiebt das Retraining des globalen neuronalen Netzes in die Queue
   */
  public queueRetrainAi(): void {
    const payload: RetrainPlannerPayload = {
      id: 'retrain-global-' + Date.now(),
      displayInfo: {
        category: 'KI-Planer',
        title: 'KI-Weiterbildung'
      }
    };

    this.queueService.enqueue(this.serviceName, 'RETRAIN_AI', payload);
  }

  // ==========================================
  // 🧹 BASE DATA MANAGER OVERRIDES
  // ==========================================

  public override resetData(): void {
    // Kein lokaler State zu bereinigen
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}