import { QueueItem } from "../../models/queue-items/queue-item";

// Definition einer gespeicherten Entwurfs-Kette
export interface DraftChain {
  id: string;               // Eindeutige Draft-ID
  name: string;             // Sprechender Name (z.B. aus dem Titel extrahiert)
  items: QueueItem[];       // Die gesammelte Kette von Queue-Items
  lastError: string;        // Der Grund des Scheiterns (z.B. "403 Forbidden")
  lastAttemptTimestamp: number; // Wann das passiert ist
}

// Das Interface, das der CentralQueueService benötigt
export interface IDraftService {
  /**
   * Speichert eine neu extrahierte Fehler-Kette in der Draft-Box
   */
  saveDraftChain(items: QueueItem[], errorReason: string, customName?: string): void;

  /**
   * Lädt alle gespeicherten Entwürfe (für die UI / den Draft-Visualizer)
   */
  getAllDraftChains(): DraftChain[];

  /**
   * Holt eine spezifische Kette zurück (für den Re-Inject)
   */
  getDraftChain(id: string): DraftChain | null;

  /**
   * Löscht eine Kette endgültig (nach erfolgreichem Re-Inject oder manuellem Verwerfen)
   */
  removeDraftChain(id: string): void;
}