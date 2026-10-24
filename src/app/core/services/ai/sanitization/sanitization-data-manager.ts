import { inject, Injectable } from '@angular/core';
import { Observable, of, Subject, tap, throwError } from 'rxjs';
import { BaseQueueDataManager } from '../../central-queue/base-queue-data-manager';
import { EmptyStateProvider } from '../../central-queue/state-providers/empty-state-provider';
import { SanitizationRepository } from '../../../repositories/sanitization-repository';
import { QueueHandlerName } from '../../../enums/queue-handler-name';
import { QueueItem } from '../../../models/queue-items/queue-item';
import { CreatePatternPayload, SanitizationQueueAction } from '../../../models/queue-items/sanitization-pattern-payload';

@Injectable({
  providedIn: 'root'
})
export class SanitizationDataManager extends BaseQueueDataManager<EmptyStateProvider> {
  private sanitizationRepository = inject(SanitizationRepository);

  private patternCreatedSubject = new Subject<void>();
  public patternCreated$ = this.patternCreatedSubject.asObservable();

  constructor() {
    super(QueueHandlerName.SANITIZATION);
  }

  protected override createStateProvider(): EmptyStateProvider {
    return new EmptyStateProvider();
  }

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as SanitizationQueueAction;

    switch (action) {
      case 'CREATE_PATTERN': {
        const payload = item.payload as CreatePatternPayload;
        // Übergibt die Daten an das Repository
        return this.sanitizationRepository.createPattern({
          selectedText: payload.selectedText,
          patternType: payload.patternType,
          reason: payload.reason
        }).pipe(
           tap(() => {
              this.patternCreatedSubject.next()
           })
        );
      }

      default:
        return throwError((): Error => new Error(`[SanitizationDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  protected override fetchFromServer(userId: string): Observable<void> {
    return of(undefined);
  }

  // 📝 Queue-Methode mit dem typisierten Payload
  public queueCreatePattern(selectedText: string, patternType: string, reason: string): void {
    const payload: CreatePatternPayload = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(), // Eindeutige ID für das Payload
      selectedText,
      patternType,
      reason,
      displayInfo: {
        category: 'Sensible Daten',
        title: `Muster anlegen: "${selectedText}"`
      }
    };

    this.queueService.enqueue(this.serviceName, 'CREATE_PATTERN', payload);
  }

  public override resetData(): void {}
  public override checkUnsavedData(): string | null { return null; }
}