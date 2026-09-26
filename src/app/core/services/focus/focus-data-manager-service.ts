import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { GamificationRepository } from '../../repositories/gamification-repsoitory';
import { UserService } from '../user/user-service';
import { LoggerService } from '../logger/logger-service';
import { GamificationResult } from '../../models/gamification';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import { FocusPomodoroPayload } from '../../models/queue-items/pomodoro-payload';
import { StateProvider } from '../central-queue/state-providers/base-state-provider';
import { EmptyStateProvider } from '../central-queue/state-providers/empty-state-provider';
import { QueueHandlerName } from '../../enums/queue-handler-name';

export type FocusQueueAction = 'RECORD_POMODORO';

@Injectable({
  providedIn: 'root'
})
export class FocusDataManagerService extends BaseQueueDataManager {
  private gamificationRepository = inject(GamificationRepository);
  private userService = inject(UserService);
  private loggerService = inject(LoggerService);

  constructor() {
    super(QueueHandlerName.FOCUS);
  }

  protected override createStateProvider(): StateProvider<any> {
    return new EmptyStateProvider();
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

  public override checkAndReplaceIds(item: QueueItem, localId: string, serverId: string): void {
    if (item.action === 'RECORD_POMODORO') {
      const payload = item.payload as FocusPomodoroPayload;
      if (payload && payload.todoId === localId) {
        payload.todoId = serverId;
      }
    }
  }

  // ==========================================
  // 🔗 DEPENDENCY & CHAIN EXTRACTION
  // ==========================================

  public override extractEntityIds(item: QueueItem): string[] {
    const ids = super.extractEntityIds(item);

    if (item.action === 'RECORD_POMODORO') {
      const payload = item.payload as FocusPomodoroPayload;
      if (payload && payload.todoId) {
        ids.push(payload.todoId);
      }
    }

    return ids;
  }

  // ==========================================
  // 🔄 REHYDRATION PATTERN
  // ==========================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return of(undefined);
  }

  // ==========================================
  // 📝 PUBLIC API METHODEN (Für FocusService / Queue)
  // ==========================================

  /**
   * Registriert ein Pomodoro-Intervall sofort in der CentralQueue.
   */
  public recordCompletedPomodoro(todoId: string, todoTitle?: string): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      return;
    }

    const payload: FocusPomodoroPayload = {
      id: generateLocalId(),
      userId,
      todoId,
      count: 1,
      displayInfo: {
        category: 'Fokus-Session',
        title: todoTitle ? `Pomodoro: "${todoTitle}"` : 'Fokus-Session abschließen'
      }
    };

    this.queueService.enqueue(this.serviceName, 'RECORD_POMODORO', payload);
    this.loggerService.info('FocusDataManager', 'Pomodoro in die globale Queue eingereiht.');
  }
  // ==========================================
  // 🧹 BASE DATA MANAGER OVERRIDES
  // ==========================================

  public override resetData(): void {
    // Kein lokaler Storage-State vorhanden
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}