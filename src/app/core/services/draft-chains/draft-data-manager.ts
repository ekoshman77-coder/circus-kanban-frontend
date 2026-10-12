import { inject, Injectable, Signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { DraftStateProvider } from './draft-state-provider';
import { DraftRepository } from '../../repositories/draft-repository';
import { DelegateDraftPayload, DeleteDraftPayload, DelegationTarget } from '../../models/queue-items/draft-queue-payload';
import { DelegateDraftDto } from '../../repositories/dto/draft-chain-dto';
import { UserService } from '../user/user-service';

@Injectable({
  providedIn: 'root'
})
export class DraftQueueDataManager extends BaseQueueDataManager<DraftStateProvider> {
  private draftRepository = inject(DraftRepository);
  private userService = inject(UserService);

  public get draftChainsSignal(): Signal<DraftChain[]> {
    return this.getSignal() as Signal<DraftChain[]>;
  }

  constructor() {
    super(QueueHandlerName.DRAFT);

    this.queueService.draftChainCreated$.subscribe((incomingChain: DraftChain) => {
      if (incomingChain.origin === 'LABOR') {
        this.handleLaborDraftCreated(incomingChain);
      } else {
        this.saveDraftChain(incomingChain);
      }
    });

    // 🚀 NEU: Reaktion auf das Beenden des Labor-Modus!
    this.queueService.laborModeExited$.subscribe(() => {
      console.log('🧪 [DraftQueueDataManager] Labor-Modus beendet -> Überführe Entwürfe in die Live-Queue!');
      this.promoteLaborDraftsToRealWorld();
    });
  }

  protected override createStateProvider(): DraftStateProvider {
    return new DraftStateProvider();
  }

  // ==========================================
  // BASE DATA MANAGER OVERRIDES (UNSAVED DATA & RESET)
  // ==========================================

  /**
   * 🛡️ Schutz beim Logout/Schließen: Warnung, falls un-synchronisierte Sandbox-Drafts vorliegen
   */
  public override checkUnsavedData(): string | null {
    const localLaborDrafts = this.draftChainsSignal().filter(
      chain => chain.origin === 'LABOR' || chain.origin === 'LOCAL'
    );

    if (localLaborDrafts.length > 0) {
      return `Du hast noch ${localLaborDrafts.length} un-synchronisierte Entwürfe aus der Sandbox. Möchtest du dich wirklich abmelden?`;
    }
    return null;
  }

  /**
   * 🧹 Setzt die Entwurfsketten für den User zurück (z.B. bei Graduation oder Clean-Reset)
   */
  public override resetData(): void {
    this.stateProvider.clearUserDrafts();
  }

  // ==========================================
  // GRADUATION & EXPORT ACTIONS
  // ==========================================

  /**
   * Exportiert alle aktuellen Sandbox-Entwürfe als JSON-String für ein Backup/Review
   */
  public exportDraftPackageJson(): string {
    const laborDrafts = this.draftChainsSignal().filter(d => d.origin === 'LABOR');
    return JSON.stringify(laborDrafts.map(d => d.toJson()), null, 2);
  }

  /**
   * 🚀 Übergibt alle Sandbox-Entwürfe an die echte CentralQueue zur Ausführung
   */
// draft-data-manager.ts
public promoteLaborDraftsToRealWorld(): void {
  const laborDrafts = this.draftChainsSignal().filter(d => d.origin === 'LABOR');
  const itemsToPromote: QueueItem[] = [];

  laborDrafts.forEach(chain => {
    chain.items.forEach(item => itemsToPromote.push(item.queueItem));
  });

  // 🚀 Push nach oben: Schreibt in den LocalStorage und führt den Service-Swap durch
  this.queueService.flushLaborItemsAndSwitchMode(itemsToPromote);

  // Eigene Sandbox-Drafts aus dem Provider aufräumen
  this.resetData();
}

public delegateAllLaborDraftsAsSinglePackage(target: DelegationTarget, note?: string): void {
    const currentUserId = this.userService.currentUser()?.id || '';
    // 1. StateProvider erledigt das atomare Zusammenfügen & Säubern des States!
    const packageChain = this.stateProvider.bundleAllLaborDrafts(
      target, 
      note || 'Automatisches Gesamt-Paket beim Logout', 
      currentUserId
    );

    if (!packageChain) return;

    // 2. Erzeuge Payload für die Queue
    const payload: DelegateDraftPayload = {
      id: packageChain.id,
      draftChain: packageChain,
      snapshot: this.stateProvider.createSnapshot(),
      displayInfo: {
        category: 'Entwurfspaket delegieren',
        title: packageChain.title
      }
    };

    // 3. Über die Queue (Bypass) abschicken!
    this.queueService.enqueue(this.serviceName, 'DELEGATE_DRAFT', payload);
  }

  // ==========================================
  // BASE QUEUE DATA MANAGER EXECUTION
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<void> {
    switch (item.action) {
      case 'DELEGATE_DRAFT': {
        const payload = item.payload as DelegateDraftPayload;
        const draftChain = DraftChain.fromJson(payload.draftChain as any);

        const dto: DelegateDraftDto = {
          ...draftChain.toJson(),
          target: draftChain.target!
        };

        return this.draftRepository.delegateDraft(dto);
      }

      case 'DELETE_SERVER_DRAFT':
        return this.draftRepository.deleteServerDraft((item.payload as DeleteDraftPayload).id);

      default:
        console.warn(`⚠️ [DraftQueueDataManager] Unbekannte Aktion: ${item.action}`);
        return of();
    }
  }

  protected override fetchFromServer(_userId: string): Observable<any> {
    return this.draftRepository.fetchAssignedDrafts().pipe(
      tap((remoteDrafts) => {
        this.stateProvider.syncRemoteDrafts(remoteDrafts);
      }),
      map(() => void 0)
    );
  }

  // ==========================================
  // PUBLIC API METHODEN FOR SERVICES
  // ==========================================

  public saveDraftChain(chain: DraftChain): void {
    this.stateProvider.applyActionPayload('SAVE_DRAFT_CHAIN', { chain });
  }

  public removeDraftChain(chainId: string): void {
    this.stateProvider.applyActionPayload('REMOVE_DRAFT_CHAIN', { chainId });
  }

  public reinjectDraftChain(draftId: string, updatedItems?: DraftChainItem[]): void {
    const draft = this.draftChainsSignal().find(d => d.id === draftId);
    if (!draft) return;

    const itemsToReinject = (updatedItems || draft.items).map(item => item.queueItem);

    this.queueService.reinjectChain(itemsToReinject);
    this.removeDraftChain(draftId);
  }

  public delegateDraftChain(chainId: string, target: DelegationTarget, note?: string): void {
    const draft = this.draftChainsSignal().find(d => d.id === chainId);
    if (!draft) return;

    const currentUserId = this.userService.currentUser()?.id || '';

    draft.target = target;
    draft.note = note ?? '';
    draft.delegatedByUserId = currentUserId;

    if (!draft.createdByUserId) {
      draft.createdByUserId = currentUserId;
    }

    const payload: DelegateDraftPayload = {
      id: draft.id,
      draftChain: draft,
      snapshot: this.stateProvider.createSnapshot(),
      displayInfo: {
        category: 'Entwurf delegieren',
        title: draft.title
      }
    };

    this.removeDraftChain(chainId);
    this.queueService.enqueue(this.serviceName, 'DELEGATE_DRAFT', payload);
  }

  // ==========================================
  // LABOR MERGING-LOGIK
  // ==========================================

private handleLaborDraftCreated(incomingChain: DraftChain): void {
    const newItem = incomingChain.items[0]?.queueItem;
    if (!newItem) {
        this.saveDraftChain(incomingChain);
        return;
    }

    const currentDrafts = this.stateProvider.getState();
    const matchingChains = currentDrafts.filter(
        chain => chain.origin === 'LABOR' && this.queueService.isItemDependentOnChain(newItem, chain.items)
    );

    // 1. Fall: Keine Abhängigkeiten -> Ganz normal als neue Kette ablegen
    if (matchingChains.length === 0) {
        this.saveDraftChain(incomingChain);
        return;
    }

    // 2. Fall: Abhängigkeiten gefunden -> Ketten zusammenführen
    const allItems: DraftChainItem[] = [];

    // Items aller passenden Ketten einsammeln
    matchingChains.forEach(chain => {
        allItems.push(...chain.items);
    });

    // Neue Items der eingehenden Kette hinzufügen
    allItems.push(...incomingChain.items);

    // Nach Timestamp sortieren (älteste Aktion zuerst)
    allItems.sort((a, b) => a.queueItem.timestamp - b.queueItem.timestamp);

    // Älteste Kette als Basis für ID, Titel und Erstellungsdatum wählen
    const oldestChain = matchingChains.reduce((prev, curr) =>
        prev.createdAt < curr.createdAt ? prev : curr
    );

    const mergedChain = oldestChain.cloneWith({
        items: allItems,
    });

    const idsToRemove = matchingChains.map(chain => chain.id);

    // 🎯 Statt n-mal removeDraftChain() + saveDraftChain() einzeln aufzurufen,
    // übergeben wir dem Provider die IDs zum Entfernen und die Merged-Kette in EINEM Aufruf:
    this.stateProvider.mergeDraftChains(idsToRemove, mergedChain);
  }
}