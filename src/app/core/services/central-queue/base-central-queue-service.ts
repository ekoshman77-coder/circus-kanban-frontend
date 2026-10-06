import { Observable, Subject } from 'rxjs';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { IQueueHandler } from './queue-handler-interface';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { DraftOrigin } from '../../repositories/dto/draft-chain-dto';
import { AUTH_CONTEXT } from '../user/auth-context';
import { ICentralQueueService } from './central-queue-service-interface';
import { inject } from '@angular/core';

export abstract class BaseCentralQueueService extends BaseDataManager implements ICentralQueueService {

    protected authContext = inject(AUTH_CONTEXT);
    protected registry = new Map<QueueHandlerName, IQueueHandler>();

    private draftChainSubject = new Subject<DraftChain>();
    draftChainCreated$: Observable<DraftChain> = this.draftChainSubject.asObservable();

    public registerService(name: QueueHandlerName, handler: IQueueHandler): void {
        if (!this.registry.has(name)) {
            this.registry.set(name, handler);
            console.log(`🔌 [${this.constructor.name}] Handler registriert: "${name}"`);
        }
    }

    /**
     * Helper zum einheitlichen Erzeugen einer DraftChain
     */
    protected createDraftChainInstance(
        title: string,
        items: DraftChainItem[],
        origin: DraftOrigin,
        errorReason = '',
        errorCode = 0
    ): DraftChain {
        return new DraftChain(
            `draft_${origin.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title,
            items,
            Date.now(),
            origin,
            this.authContext.getCurrentUserId() || '',
            errorReason,
            errorCode
        );
    }

    /**
     * Sendet eine fertig gebaute Kette an das Draft-System
     */
    protected emitDraftChain(chain: DraftChain): void {
        this.draftChainSubject.next(chain);
    }

    public isItemDependentOnChain(newItem: QueueItem, chainItems: DraftChainItem[]): boolean {
        if (!newItem || !chainItems || chainItems.length === 0) return false;

        // 1. Extrahiere alle relevanten IDs über den registrierten Handler
        const newHandler = this.registry.get(newItem.serviceName);

        // Falls für ein brandneues Item kein Handler existiert -> Abbruch (kann nicht verarbeitet werden)
        if (!newHandler) {
            console.warn(`⚠️ [CentralQueue] Kein Handler für Service "${newItem.serviceName}" registriert.`);
            return false;
        }

        const newItemIds = new Set(newHandler.extractEntityIds(newItem));
        if (newItemIds.size === 0) return false;

        // 2. Prüfe, ob ein Item der Kette auf diese IDs reagiert
        return chainItems.some(chainItem => {
            const itemHandler = this.registry.get(chainItem.queueItem.serviceName);

            // Safe Fallback: Wenn für ein altes Kettenglied kein Handler existiert -> Überspringen
            if (!itemHandler) {
                console.warn(`⚠️ [CentralQueue] Veraltetes Kettenglied ignoriert (Service "${chainItem.queueItem.serviceName}" fehlt).`);
                return false;
            }

            // 🎯 WICHTIG: Das explicit 'return' vor itemHandler.dependsOnId(...)!
            return itemHandler.dependsOnId(chainItem.queueItem, newItemIds);
        });
    }
    
    // --- Gemeinsame abstrakte & Standard-Methoden ---
    public abstract enqueue(serviceName: QueueHandlerName, action: string, payload: SnapshotPayload): QueueItem;
    public abstract processQueue(): Promise<void>;

    public hasPendingItems(): boolean { return false; }
    public getQueue(): QueueItem[] { return []; }
    public removeItemsForEntity(localId: string): void { }
    public updateEntityIdInQueue(localId: string, serverId: string): void { }
    public reinjectChain(items: QueueItem[]): void { }
    public extractDependentChain(): QueueItem[] { return []; }
    public setFetchingState(isFetching: boolean): void { }
    public isFetching(): boolean { return false; }
}