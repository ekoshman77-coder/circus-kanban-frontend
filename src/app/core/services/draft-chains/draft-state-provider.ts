import { inject } from '@angular/core';
import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';
import { DelegationTarget, DraftQueueActions } from '../../models/queue-items/draft-queue-payload';
import { DraftChain, DraftChainItem } from '../../models/draft-chain';
import { DraftChainDto } from '../../repositories/dto/draft-chain-dto';
import { UserService } from '../user/user-service';

export class DraftStateProvider extends ArrayStateProvider<DraftChain> {
  private userService = inject(UserService);

  // 🎯 User-isolierter Key für Multi-User-Sicherheit am selben PC
  protected override get storageKey(): string {
    const userId = this.userService.currentUser()?.id;
    return userId ? `sandbox_drafts_${userId}` : 'global_draft_chains_store';
  }

  protected modelStatic = DraftChain;

  constructor() {
    super([]);
  }

  // ==========================================
  // STORAGE & RESET MANAGEMENT
  // ==========================================

  /**
   * Löscht nur den Speicher des aktuellen Users
   */
  public clearUserDrafts(): void {
    this.setRawState([]);
    if (this.storageKey) {
      this.localStorageService.removeItem(this.storageKey);
    }
  }

  // ==========================================
  // FORWARD REPLAY / ACTIONS
  // ==========================================

  public override applyActionPayload(action: DraftQueueActions | string, payload: any): void {
    switch (action as DraftQueueActions) {
      case 'SAVE_DRAFT_CHAIN':
        if (payload?.chain) {
          const chainInstance = payload.chain instanceof DraftChain
            ? payload.chain
            : DraftChain.fromJson(payload.chain);
          this.addOrUpdateItem(chainInstance);
        }
        break;

      case 'REMOVE_DRAFT_CHAIN':
        if (payload?.chainId) {
          this.removeItemById(payload.chainId);
        }
        break;

      case 'SYNC_REMOTE_DRAFTS':
        if (Array.isArray(payload?.remoteDrafts)) {
          this.syncRemoteDrafts(payload.remoteDrafts);
        }
        break;
    }
  }

  // ==========================================
  // ATOMIC MERGING & STATE SYNC
  // ==========================================

  /**
   * Löscht alte abhängige Ketten und fügt die zusammengefügte Kette atomar ein (ein einzelnes UI-Signal-Update)
   */
  public mergeDraftChains(idsToRemove: string[], mergedChain: DraftChain): void {
    const removeSet = new Set(idsToRemove);

    this.applyAction((currentItems) => {
      const filtered = currentItems.filter(item => !removeSet.has(item.id));
      const index = filtered.findIndex(item => item.id === mergedChain.id);

      if (index >= 0) {
        const copy = [...filtered];
        copy[index] = mergedChain;
        return copy;
      }
      return [...filtered, mergedChain];
    });
  }

  /**
   * 📦 Bündelt alle 'LABOR'-Entwürfe atomar zu einer einzigen Gesamt-DraftChain
   * und entfernt die ursprünglichen Einzelketten aus dem State.
   */
  public bundleAllLaborDrafts(
    target: DelegationTarget, 
    note: string, 
    currentUserId: string
  ): DraftChain | null {
    const currentList = this.getState();
    const laborDrafts = currentList.filter(d => d.origin === 'LABOR');

    if (laborDrafts.length === 0) return null;

    // 1. Alle items aus allen Labor-Ketten sammeln
    const allItems: DraftChainItem[] = [];
    laborDrafts.forEach(chain => allItems.push(...chain.items));

    // 2. Chronologisch nach Timestamp sortieren
    allItems.sort((a, b) => a.queueItem.timestamp - b.queueItem.timestamp);

    // 3. Markieren: Nur das allererste Item ist Root-Cause
    const sanitizedItems = allItems.map((item, index) => ({
      ...item,
      isRootCause: index === 0
    }));

    // 4. Einziges Paket erzeugen
    const packageChain = new DraftChain({
      id: `draft_package_labor_${Date.now()}`,
      title: `Praktikanten-Entwurfspaket (${sanitizedItems.length} Aktionen)`,
      items: sanitizedItems,
      createdAt: Date.now(),
      origin: 'LABOR',
      createdByUserId: currentUserId,
      target,
      delegatedByUserId: currentUserId,
      note
    });

    // 5. ATOMARES UPDATE: Entferne alle alten Labor-Ketten & füge das Paket nicht ein (oder ersetze es)
    const removeSet = new Set(laborDrafts.map(d => d.id));
    this.applyAction((items) => items.filter(item => !removeSet.has(item.id)));

    return packageChain;
  }
  
  public syncRemoteDrafts(fetchedRemoteDrafts: DraftChainDto[]): void {
    const currentList = this.getState();

    // 1. Alle IDs vom Server sammeln
    const remoteIds = new Set(fetchedRemoteDrafts.map(dto => dto.id));

    // 2. Prüfen, ob der Server IDs geliefert hat, die lokal noch als LOCAL existieren
    const overlappingLocalDrafts = currentList.filter(
      chain => chain.origin === 'LOCAL' && remoteIds.has(chain.id)
    );

    if (overlappingLocalDrafts.length > 0) {
      console.warn(
        `⚠️ [DraftStateProvider] Überschneidung entdeckt! Der Server hat Entwürfe geliefert, die lokal als 'LOCAL' markiert sind:`,
        overlappingLocalDrafts.map(d => d.id)
      );
    }

    // 3. Nur wirklich reine lokale Drafts behalten, die NICHT vom Server stammen
    const purelyLocalDrafts = currentList.filter(
      chain => chain.origin === 'LOCAL' && !remoteIds.has(chain.id)
    );

    // 4. Remote-Drafts mappen
    const preparedRemoteDrafts = fetchedRemoteDrafts.map(dto =>
      DraftChain.fromJson(dto)
    );

    this.setRawState([...purelyLocalDrafts, ...preparedRemoteDrafts]);
  }

  public saveDraftChain(chain: DraftChain): void {
    this.applyActionPayload('SAVE_DRAFT_CHAIN', { chain });
  }

  public removeDraftChain(chainId: string): void {
    this.applyActionPayload('REMOVE_DRAFT_CHAIN', { chainId });
  }

}