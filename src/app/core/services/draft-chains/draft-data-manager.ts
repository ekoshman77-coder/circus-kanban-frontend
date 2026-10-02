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
export class DraftQueueDataManager extends BaseQueueDataManager {
    private draftRepository = inject(DraftRepository);
    private userService = inject(UserService)

    public get draftChainsSignal(): Signal<DraftChain[]> {
        return this.getSignal() as Signal<DraftChain[]>;
    }

    constructor() {
        super(QueueHandlerName.DRAFT);
        (this.stateProvider as DraftStateProvider).loadFromCache();

        // Reagiert auf fehlgeschlagene Queue-Aktionen
        this.queueService.queueFailed$.subscribe(({ items, error, errorCode }) => {
            this.createDraftFromFailedQueue(items, error, errorCode);
        });
    }

    protected override createStateProvider(): DraftStateProvider {
        return new DraftStateProvider();
    }

    private get draftState(): DraftStateProvider {
        return this.stateProvider as DraftStateProvider;
    }

    // ==========================================
    // BASE QUEUE DATA MANAGER EXECUTION
    // ==========================================

    public override executeQueueItem(item: QueueItem): Observable<any> {
        switch (item.action) {
            case 'DELEGATE_DRAFT': {
                const payload = item.payload as DelegateDraftPayload;

                // 🎯 Immer sauber über fromJson in eine echte Domain-Instanz wandeln
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
                return of(true);
        }
    }

    protected override fetchFromServer(_userId: string): Observable<void> {
        return this.draftRepository.fetchAssignedDrafts().pipe(
            tap((remoteDrafts) => {
                this.draftState.syncRemoteDrafts(remoteDrafts);
            }),
            map(() => void 0)
        );
    }

    // ==========================================
    // 📝 PUBLIC API METHODEN FOR SERVICE
    // ==========================================

    public saveDraftChain(chain: DraftChain): void {
        this.draftState.applyActionPayload('SAVE_DRAFT_CHAIN', { chain });
    }

    public removeDraftChain(chainId: string): void {
        this.draftState.applyActionPayload('REMOVE_DRAFT_CHAIN', { chainId });
    }

    public createDraftFromFailedQueue(items: QueueItem[], errorReason: string, errorCode: number): void {
        if (!items || items.length === 0) return;

        const draftItems: DraftChainItem[] = items.map((item, index) => ({
            queueItem: structuredClone(item),
            isRootCause: index === 0
        }));

        const title = items[0]?.payload?.displayInfo?.title || 'Fehlerhafte Operation';

        // ✅ Korrekte Interpolation mit Backticks und $
        const newDraft = new DraftChain(
            `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title,
            draftItems,
            Date.now(),
            'LOCAL',
            '',
            errorReason,
            errorCode
        );

        this.saveDraftChain(newDraft);
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

        // Aktuellen User aus dem UserService / Context holen
        const currentUserId = this.userService.currentUser()?.id || '';

        draft.target = target;
        draft.note = note ?? '';
        draft.delegatedByUserId = currentUserId;

        // Falls createdByUserId noch leer war, mit aktuellem User belegen
        if (!draft.createdByUserId) {
            draft.createdByUserId = currentUserId;
        }

        const payload: DelegateDraftPayload = {
            id: draft.id,
            draftChain: draft,
            snapshot: this.draftState.createSnapshot(),
            displayInfo: {
                category: 'Entwurf delegieren',
                title: draft.title
            }
        };

        this.removeDraftChain(chainId);
        this.queueService.enqueue(this.serviceName, 'DELEGATE_DRAFT', payload);
    }
}