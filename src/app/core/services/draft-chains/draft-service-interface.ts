import { Signal } from "@angular/core";
import { Observable } from "rxjs";
import { DraftChain } from "../../models/draft-chain";
import { QueueItem } from "../../models/queue-items/queue-item";


export interface IDraftService {
  /** Reactive Signals für die UI */
  readonly draftChains: Signal<DraftChain[]>;
  readonly draftCount: Signal<number>;

  /** Speichert eine abgekoppelte Fehler-Kette */
  saveDraftChain(items: QueueItem[], errorReason: string, errorCode: number, customTitle?: string): void;

  /** Einzelnen Draft zur Einsicht/Bearbeitung holen */
  getDraftChain(id: string): DraftChain | null;

  /** Aktualisiert ein bestimmtes QueueItem innerhalb eines Drafts (Korrektur-Modus) */
  updateDraftItemPayload(draftId: string, itemId: string, updatedPayload: any): void;

  /** Stößt den Re-Inject an (feuert reInjectChain$ und entfernt den Draft) */
  reinjectDraftChain(draftId: string): void;

  /** Löscht einen Draft manuell (Verwerfen) */
  removeDraftChain(id: string): void;

  /** Setzt alle Drafts zurück (z. B. bei Logout) */
  clearAllDrafts(): void;
}