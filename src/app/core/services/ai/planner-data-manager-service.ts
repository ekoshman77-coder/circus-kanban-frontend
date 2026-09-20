import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { StateProvider } from '../central-queue/state-providers/base-state-provider';
import { EmptyStateProvider } from '../central-queue/state-providers/empty-state-provider';
import { AiRepository, RejectedTodoFeedback } from '../../repositories/ai-repository';
import { PlannerFeedbackPayload, SnoozePayload } from '../../models/queue-items/planner-queue-payload';


export type PlannerQueueAction = 'SEND_FEEDBACK' | 'SNOOZE_TODO';

@Injectable({
  providedIn: 'root'
})
export class PlannerDataManagerService extends BaseQueueDataManager {
  private aiRepository = inject(AiRepository);

  constructor() {
    super('PlannerDataManagerService');
  }

  protected override createStateProvider(): StateProvider<any> {
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
        return this.aiRepository.sendPlannerFeedback({
          id: '',
          userId: payload.userId,
          roundId: payload.roundId,
          acceptedTodoId: payload.acceptedTodoId,
          rejectedTodos: payload.rejectedTodos
        });
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

      default:
        return throwError(() => new Error(`[PlannerDataManager] Unbekannte Action: ${item.action}`));
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

  public queueFeedback(userId: string, roundId: string, acceptedTodoId: string | null, rejectedTodos: RejectedTodoFeedback[]): void {
    const payload: PlannerFeedbackPayload = {
      id: roundId,
      userId,
      roundId,
      acceptedTodoId,
      rejectedTodos
    };

    this.queueService.enqueue(this.serviceName, 'SEND_FEEDBACK', payload);
  }

  public queueSnooze(todoId: string, durationInMin: number): void {
    const payload: SnoozePayload = {
      id: todoId,
      durationInMin
    };

    this.queueService.enqueue(this.serviceName, 'SNOOZE_TODO', payload);
  }

  // ==========================================
  // 🧹 BASE DATA MANAGER OVERRIDES
  // ==========================================

  public override resetData(): void {
    // Kein lokaler Cache zu bereinigen
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}