import { inject, Injectable, Injector, runInInjectionContext, signal } from '@angular/core';
import { finalize, map, Observable, of, Subject, tap } from 'rxjs';
import { QueueHandlerName } from '../../enums/queue-handler-name';
import { IQueueHandler } from './queue-handler-interface';
import { QueueItem, SnapshotPayload } from '../../models/queue-items/queue-item';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { ICentralQueueService } from './central-queue-service-interface';
import { LiveCentralQueueService } from './live-central-queue-service';
import { LaborCentralQueueService } from './labor-central-queue-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { AUTH_CONTEXT } from '../user/auth-context';
import { UserService } from '../user/user-service';

@Injectable({
  providedIn: 'root'
})
export class CentralQueueService extends BaseDataManager implements ICentralQueueService {
  private readonly LABOR_FLAG_KEY = 'global_labor_mode_active';
  private injector = inject(Injector);
  private authContext = inject(AUTH_CONTEXT)

  public isLaborMode = signal(false);

  // 📢 Event-Stream für das Beenden des Labor-Modus
  private laborModeExitedSubject = new Subject<void>();
  public laborModeExited$ = this.laborModeExitedSubject.asObservable();

  // Dynamische Instanz – immer genau einer der beiden Services ist aktiv
  private activeServiceInstance: LiveCentralQueueService | LaborCentralQueueService | null = null;

  // Globaler Registrierungscache für Handler, damit sie bei Moduswechseln automatisch injiziert werden
  private registeredHandlers = new Map();

  // DRAFT-CHAIN STREAM: Delegiert auf das Subject des jeweils aktiven Services
  private draftChainSubject = new Subject<DraftChain>();
  public draftChainCreated$: Observable<DraftChain> = this.draftChainSubject.asObservable();

  constructor() {
    super();
    // 🛡️ 1. Modus direkt beim Bootstrapping aus dem LocalStorage auslesen
    const isLaborActive = this.localStorageService.getItem(this.LABOR_FLAG_KEY) === true;
    this.isLaborMode.set(isLaborActive);

    // 🛡️ 2. Ausschließlich den benötigten Service instanziieren
    this.bootActiveService();

    this.authContext.onLogout$.subscribe(() => {
      console.log('🧹 [CentralQueueService] Logout erkannt! Setze Queue & DataManager zurück...');
      this.resetData();
    });
  }

  public toggleLaborMode(): void {
    const isLeavingLabor = this.isLaborMode();
    const nextState = !isLeavingLabor;

    this.isLaborMode.set(nextState);
    this.localStorageService.setItem(this.LABOR_FLAG_KEY, nextState);

    console.log(`🔀 Modus gewechselt. Bootstrappe ${nextState ? '🧪 LABOR-SANDBOX' : '🔴 LIVE-SERVICE'}...`);

    // 1. Zuerst den neuen Service (LiveCentralQueueService) instanziieren!
    this.bootActiveService();

    // 2. Erst JETZT emittieren wir, dass der Labor-Modus verlassen wurde.
    // Zu diesem Zeitpunkt steht die LiveCentralQueue bereits frisch bereit!
    if (isLeavingLabor) {
      console.log('📢 [CentralQueueService] Labor-Modus beendet. Benachrichtige DataManager...');
      this.laborModeExitedSubject.next();
    }
  }

  // central-queue-service.ts
  public flushLaborItemsAndSwitchMode(laborItems: QueueItem[]): void {
    // 1. Solange der LaborCentralQueueService noch aktiv ist: Items in den Live-LocalStorage flushen!
    if (this.isLaborMode() && laborItems.length > 0 && this.activeServiceInstance instanceof LaborCentralQueueService) {
      this.activeServiceInstance.flushToLiveStorage(laborItems);
    }

    // 2. Modus umschalten & persisten
    this.isLaborMode.set(false);
    this.localStorageService.setItem(this.LABOR_FLAG_KEY, false);

    console.log('🔴 [CentralQueue] Labor-Modus beendet. Swappe zu LiveCentralQueueService...');

    // 3. Erst JETZT den LiveCentralQueueService booten!
    // Findet im constructor sofort die gefüllte Offline-Queue im LocalStorage vor! 🚀
    this.bootActiveService();
  }

  /**
   * 🚀 Führt einen initialen Live-Fetch durch und schaltet danach GARANTIERT
   * (auch bei Netzfehlern) in den isolierten Labor-Modus um.
   */
public bootstrapLiveAndSealLabor(): Observable<void> {
    console.log('🧪 [Bootstrap] Initialisiere Labor-Modus...');

    if (!this.isLaborMode()) {
      this.isLaborMode.set(true);
      this.localStorageService.setItem(this.LABOR_FLAG_KEY, true);
      this.bootActiveService();
    }

    const laborService = this.activeServiceInstance as LaborCentralQueueService;
    const userId = this.authContext.getCurrentUserId() || '';

    if (!laborService) {
      return of(void 0);
    }

    return laborService.fetchInitialDataForLabor(userId).pipe(
      map(() => void 0)
    );
  }
  private bootActiveService(): void {
    if (this.activeServiceInstance) {
      console.log('🧹 [CentralQueueFacade] Alte Service-Instanz wird destroyed...');
      this.activeServiceInstance.destroy();
      this.activeServiceInstance = null;
    }

    if (this.isLaborMode()) {
      console.log(`🧪 [CentralQueueFacade] Bootstrappe LaborCentralQueueService mit ${this.registeredHandlers.size} Handlern.`);
      this.activeServiceInstance = runInInjectionContext(this.injector, () =>
        new LaborCentralQueueService(this.registeredHandlers)
      );
    } else {
      console.log(`🔴 [CentralQueueFacade] Bootstrappe LiveCentralQueueService mit ${this.registeredHandlers.size} Handlern.`);
      this.activeServiceInstance = runInInjectionContext(this.injector, () =>
        new LiveCentralQueueService(this.registeredHandlers)
      );
    }

    // 3. Registrierte Handler nachziehen
    this.registeredHandlers.forEach((handler, name) => {
      this.activeServiceInstance?.registerService(name, handler);
    });

    // 4. Draft-Stream koppeln
    this.activeServiceInstance.draftChainCreated$.subscribe(chain => {
      this.draftChainSubject.next(chain);
    });
  }

  private activeService(): ICentralQueueService {
    if (!this.activeServiceInstance) {
      this.bootActiveService();
    }
    return this.activeServiceInstance!;
  }

  // ==========================================
  // DELEGATION ALLER INTERFACE-METHODEN
  // ==========================================

  public registerService(name: QueueHandlerName, handler: IQueueHandler): void {
    // Merkt sich den Handler im zentralen Registry-Cache
    this.registeredHandlers.set(name, handler);
    console.log(`🔌 [CentralQueueFacade] Handler registriert: "${name}" (Gesamt: ${this.registeredHandlers.size})`);
  }

  public enqueue(serviceName: QueueHandlerName, action: string, payload: SnapshotPayload): QueueItem {
    return this.activeService().enqueue(serviceName, action, payload);
  }

  public processQueue(): Promise<void> {
    return this.activeService().processQueue();
  }

  public hasPendingItems(): boolean {
    return this.activeService().hasPendingItems();
  }

  public getQueue(): QueueItem[] {
    return this.activeService().getQueue();
  }

  public removeItemsForEntity(localId: string): void {
    this.activeService().removeItemsForEntity(localId);
  }

  public updateEntityIdInQueue(localId: string, serverId: string): void {
    this.activeService().updateEntityIdInQueue(localId, serverId);
  }

  public reinjectChain(items: QueueItem[]): void {
    this.activeService().reinjectChain(items);
  }

  public extractDependentChain(): QueueItem[] {
    return this.activeService().extractDependentChain();
  }

  public isItemDependentOnChain(newItem: QueueItem, chainItems: DraftChainItem[]): boolean {
    return this.activeService().isItemDependentOnChain(newItem, chainItems);
  }

  public setFetchingState(isFetching: boolean): void {
    this.activeService().setFetchingState(isFetching);
  }

  public isFetching(): boolean {
    return this.activeService().isFetching();
  }

  public override resetData(): void {
    this.activeService().resetData();
  }

  public override checkUnsavedData(): string | null {
    return this.activeService().checkUnsavedData();
  }
}