import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { AiRepository, PlannerFeedbackPayload, RejectedTodoFeedback, SnoozePayload } from '../../repositories/ai-repository';

export type PlannerQueueAction = 'SEND_FEEDBACK' | 'SNOOZE_TODO';

@Injectable({
  providedIn: 'root'
})
export class PlannerDataManagerService extends BaseQueueDataManager {

  private aiRepository = inject(AiRepository);

  // ==========================================
  // 🚀 QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================

  constructor() {
    super('PlannerDataManagerService')
  }
  
  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as PlannerQueueAction;
    
    switch (action) {
      case 'SEND_FEEDBACK': {
        const payload = item.payload as PlannerFeedbackPayload; 
        return this.aiRepository.sendPlannerFeedback({
          id: "", // Strippen der ID für Backend-Konsistenz
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
        return throwError((): Error => new Error(`[PlannerDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  // ==========================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================

  protected override fetchFromServer(userId: string): Observable<void> {
    // KI-Feedback speichert keinen eigenen lokalen Server-State im Manager
    return of(undefined);
  }

  public override resetState(snapshot: unknown): void {
    // Kein lokaler State vorhanden, der zurückgesetzt werden müsste
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    // Keine Entity-Erstellung im PlannerDataManager
  }

  protected override handleWithoutSnapshot(item: QueueItem): void {
    // Keine Snapshot-Restauration nötig
  }

  // ==========================================
  // 📝 QUEUE AKTIONEN SCHIEBEN
  // ==========================================

  public queueFeedback(userId: string, roundId: string, acceptedTodoId: string | null, rejectedTodos: RejectedTodoFeedback[]): void {
    const payload = {
      id: roundId,
      userId,
      roundId,
      acceptedTodoId,
      rejectedTodos
    };

    this.queueService.enqueue(this.serviceName, 'SEND_FEEDBACK', payload);
  }

  public queueSnooze(todoId: string, durationInMin: number): void {
    const payload = {
      id: todoId,
      durationInMin
    };

    this.queueService.enqueue(this.serviceName, 'SNOOZE_TODO', payload);
  }

  public override resetData(): void {
    // Kein lokaler Cache zu bereinigen
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}