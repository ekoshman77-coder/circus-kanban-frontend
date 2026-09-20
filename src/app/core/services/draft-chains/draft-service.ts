import { Injectable } from '@angular/core';
import { IDraftService, DraftChain } from './draft-service-interface';
import { QueueItem } from '../../models/queue-items/queue-item';

@Injectable({
  providedIn: 'root'
})
export class MockDraftService implements IDraftService {
  saveDraftChain(items: QueueItem[], errorReason: string, customName?: string): void {
    console.log(`📦 [MockDraftService] Entwurf gespeichert (${items.length} Items):`, {
      errorReason,
      customName,
      items
    });
  }

  getAllDraftChains(): DraftChain[] {
    return [];
  }

  getDraftChain(id: string): DraftChain | null {
    return null;
  }

  removeDraftChain(id: string): void {
    console.log(`🗑️ [MockDraftService] Entwurf gelöscht: ${id}`);
  }
}