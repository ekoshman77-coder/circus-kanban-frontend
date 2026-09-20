import { Permission } from "../permission";
import { PermissionJson } from "../../repositories/dto/permission-json";
import { SnapshotPayload } from "./queue-item";

export type PermissionQueueAction = 'SET_PERMISSIONS' | 'CREATE' | 'UPDATE' | 'DELETE' | 'BATCH';

// 1. Gemeinsame Basis für alle Permission-Payloads
export interface PermissionSnapshotPayload extends SnapshotPayload<PermissionJson> {}

// 2. CREATE & UPDATE: Tragen das Permission-Objekt
export interface PermissionPayload extends PermissionSnapshotPayload {
  permission: Permission;
}

// 3. DELETE: Braucht nur die ID (erbt id aus SnapshotPayload)
export interface DeletePermissionPayload extends PermissionSnapshotPayload {}

// 4. BATCH_CREATE: Die einzige Spezial-Operation für Mehrfachzuweisungen
export interface BatchCreatePermissionsPayload extends PermissionSnapshotPayload {
  roles: string[];
  resource: string;
  actions: string[];
  scope: string;
  specialization?: string;
}