// 1. Grund-Interface: Jedes Payload braucht eine ID und kann optional einen Snapshot tragen

import { QueueHandlerName } from "../../enums/queue-handler-name";

export interface PayloadContextInfo {
  category: string;  // z.B. "Abteilung", "Notiz", "To-Do"
  title: string;     // z.B. "Marketing", "Sprint Planning"
}

// J = Typ der Entität im Snapshot (z.B. Todo, Note)
export interface SnapshotPayload< J = any > {
  id: string;
  snapshot?: J[];
  displayInfo: PayloadContextInfo
}

// 2. Das generische QueueItem
// T = Spezifischer Payload-Typ, der von SnapshotPayload< J> erbt
export interface QueueItem< T extends SnapshotPayload = SnapshotPayload > {
  id: string;          // Eindeutige Queue-ID
  serviceName: QueueHandlerName; // Z.B. 'TodoDataManagerService'
  action: string;      // Z.B. 'CREATE_TODO'
  payload: T;          // Nutzdaten inklusive optionalem Snapshot
  timestamp: number;
}