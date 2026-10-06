// src/app/core/services/central-queue/labor-central-queue.service.ts

import { Injectable } from '@angular/core';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import { BaseCentralQueueService } from './base-central-queue-service';

@Injectable({
  providedIn: 'root'
})
export class LaborCentralQueueService extends BaseCentralQueueService {

  public override enqueue(serviceName: QueueHandlerName, action: string, payload: SnapshotPayload): QueueItem {
    const newItem: QueueItem = {
      id: generateLocalId(),
      serviceName,
      action,
      payload,
      timestamp: Date.now()
    };

    const title = payload.displayInfo?.title || `Labor: ${action}`;

    // Nutzt die Helper-Methode aus BaseCentralQueueService
    const laborChain = this.createDraftChainInstance(
      title,
      [{ queueItem: newItem, isRootCause: false }],
      'LABOR',
      'Labor-Modus Simulation'
    );

    console.log(`🧪 [Labor-Modus] Aktion abgefangen & Entwurf erzeugt: ${action}`, laborChain);

    // Emittiert die Kette über den zentralen Stream
    this.emitDraftChain(laborChain);

    return newItem;
  }

  public override async processQueue(): Promise<void> {
    // Im Labor-Modus erfolgt keine Server-Abarbeitung
  }

  public override resetData(): void {
    // Keine lokale State-Abarbeitung im Labor-Service notwendig
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}