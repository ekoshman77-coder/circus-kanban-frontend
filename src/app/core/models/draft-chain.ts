import { QueueItem } from '../models/queue-items/queue-item';

export interface DraftChainItem {
  queueItem: QueueItem;
  isRootCause: boolean;       // true = Das Element, das den Abbruch verursacht hat
}

export interface DraftChain {
  id: string;                  // z. B. "draft_1695280000"[cite: 4]
  title: string;               // Lesbarer Name[cite: 4]
  items: DraftChainItem[];     // Die isolierten QueueItems[cite: 4]
  createdAt: number;           // Zeitstempel[cite: 4]
  
  // Zentrale Fehlerinformationen für das UI / Routing
  lastErrorReason: string;     // Lesbarer Text (z. B. "Berechtigung fehlt")[cite: 4]
  lastErrorCode: number;       // HTTP-Code (z. B. 403 oder 409) für den Farb-Akzent
}