import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';
import { DraftQueueActions } from '../../models/queue-items/draft-queue-payload';
import { DraftChain } from '../../models/draft-chain';
import { DraftChainDto } from '../../repositories/dto/draft-chain-dto';

export class DraftStateProvider extends ArrayStateProvider< DraftChain > {
  protected override storageKey = 'global_draft_chains_store';

  // 🎯 Statische Modell-Referenz für generisches Deserialisieren & Cache-Laden
  protected modelStatic = DraftChain;

  constructor() {
    super([]);
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
  // REMOTE & LOCAL STATE MANAGEMENT
  // ==========================================

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

    // 5. State setzen
    this.setRawState([...purelyLocalDrafts, ...preparedRemoteDrafts]);
  }

  public saveDraftChain(chain: DraftChain): void {
    this.applyActionPayload('SAVE_DRAFT_CHAIN', { chain });
  }

  public removeDraftChain(chainId: string): void {
    this.applyActionPayload('REMOVE_DRAFT_CHAIN', { chainId });
  }
}