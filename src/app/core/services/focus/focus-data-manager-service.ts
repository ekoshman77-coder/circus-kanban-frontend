import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { GamificationRepository } from '../../repositories/gamification-repsoitory';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { GamificationResult } from '../../models/gamification';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import { FocusPomodoroPayload } from '../../models/queue-items/pomodoro-payload';

export type FocusQueueAction = 'RECORD_POMODORO';

@Injectable({
  providedIn: 'root'
})
export class FocusDataManagerService extends BaseQueueDataManager {

  private gamificationRepository = inject(GamificationRepository);
  private userService = inject(UserService);
  private loggerService = inject(LoggerService);

  constructor() {
    super('FocusDataManagerService');
  }

  // ==========================================
  // 🚀 QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as FocusQueueAction;

    switch (action) {
      case 'RECORD_POMODORO': {
        const payload = item.payload as FocusPomodoroPayload;
        const { userId, todoId } = payload;

        return this.gamificationRepository.sendPomodoroSession(userId, { todoId, count: 1 });
      }
      default:
        return throwError((): Error => new Error(`[FocusDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override handleQueueResult(item: QueueItem, success: boolean, response: GamificationResult | null): void {
    if (success && response) {
      // 🏆 Sobald das Pomodoro online verbucht ist, bekommt der User seine XP im Header
      this.userService.updateGamification(response);
      this.loggerService.info('FocusDataManager', 'Pomodoro verbucht. XP & Level im State aktualisiert!');
    } else if (!success) {
      this.loggerService.warn(
        'FocusDataManager',
        `Fehler beim Verbuchen von Pomodoro für Todo ID: ${(item.payload as FocusPomodoroPayload).todoId}`
      );
    }
  }

  // ==========================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================

  protected override fetchFromServer(userId: string): Observable<void> {
    // Gamification hat keinen eigenständigen Sync-Cache im Manager
    return of(undefined);
  }

  public override resetState(snapshot: unknown): void {
    // Kein lokaler Snapshot-State vorhanden
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    // Keine Entity-Erstellung
  }

  protected override handleWithoutSnapshot(item: QueueItem): void {
    // Keine Snapshot-Restauration nötig
  }

  // ==========================================
  // 📝 PUBLIC API METHODEN (Für Timer/Pomodoro UI)
  // ==========================================

  /**
   * Registriert ein Pomodoro-Intervall sofort optimistisch und schiebt es in die CentralQueue.
   */
  public recordCompletedPomodoro(todoId: string): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      return;
    }

    const payload: FocusPomodoroPayload = {
      id: generateLocalId(),
      userId,
      todoId,
      count: 1
    };
    
    // In die CentralQueue schieben (Handles Online & Offline vollautomatisch)
    this.queueService.enqueue(this.serviceName, 'RECORD_POMODORO', payload);

    this.loggerService.info('FocusDataManager', 'Pomodoro in die globale Queue eingereiht.');
  }

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
  if (item.action === 'RECORD_POMODORO') {
    const payload = item.payload as FocusPomodoroPayload;
    if (payload.todoId === localId) {
      payload.todoId = serverId;
    }
  }
}

  public override resetData(): void {
    // Kein lokaler Storage-State vorhanden
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}