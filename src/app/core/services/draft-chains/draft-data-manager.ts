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

        // 🎯 Ein einziger zentraler Stream für alle neu erzeugten Entwürfe
        this.queueService.draftChainCreated$.subscribe((incomingChain: DraftChain) => {
            if (incomingChain.origin === 'LABOR') {
                // Platzhalter für die Intelligente Merging-Logik im nächsten Schritt
                this.handleLaborDraftCreated(incomingChain);
            } else {
                // Normale Live-Fehler-Ketten direkt speichern
                this.saveDraftChain(incomingChain);
            }
        });
    }

    protected override createStateProvider(): DraftStateProvider {
        return new DraftStateProvider();
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
    // 📝 PUBLIC API METHODEN FOR SERVICE
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
    // LABOR MERGING-ROUTING 
    // ==========================================
    // Im DraftQueueDataManager:

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

        // Items der bestehenden Ketten einsammeln und alte Ketten entfernen
        matchingChains.forEach(chain => {
            allItems.push(...chain.items);
            this.removeDraftChain(chain.id);
        });

        // Neue Items hinzufügen
        allItems.push(...incomingChain.items);

        // Nach Timestamp sortieren (älteste Aktion zuerst)
        allItems.sort((a, b) => a.queueItem.timestamp - b.queueItem.timestamp);

        // Älteste Kette als Basis für ID und Titel wählen
        const oldestChain = matchingChains.reduce((prev, curr) =>
            prev.createdAt < curr.createdAt ? prev : curr
        );

        const mergedChain = oldestChain.cloneWith({
            items: allItems,
            // createdAt behalten wir von der ältesten Kette
        });

        this.saveDraftChain(mergedChain);
    }
}