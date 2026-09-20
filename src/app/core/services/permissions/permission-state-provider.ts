import { Permission } from '../../models/permission';
import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';
import {
  BatchCreatePermissionsPayload,
  DeletePermissionPayload,
  PermissionPayload,
  PermissionQueueAction
} from '../../models/queue-items/permission-queue-item';
import { generateLocalId } from '../../shared/constants/id-const';

export class PermissionStateProvider extends ArrayStateProvider<Permission> {
  
  protected storageKey: string = 'global_permissions_pool'

  constructor() {
    super([]);
  }

  public override loadFromCache(): void {
    const cached = this.localStorageService.getItem<Permission[]>(this.storageKey);
    if (cached) {
      this.setRawState(cached.map((p) => Permission.fromJson(p)));
    }
  }

  // 🚀 Einzige Schnittstelle für State-Änderungen über reine Action-Namen & Payloads
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as PermissionQueueAction) {
      case 'SET_PERMISSIONS': {
         const permissions = (payload as Permission[]).map(permission => Permission.fromJson(permission));
         this.setRawState(permissions);
         break;
      }
      case 'CREATE':
      case 'UPDATE': {
        const createPayload = payload as PermissionPayload;
        this.addOrUpdateItem(createPayload.permission);
        break;
      }
      case 'DELETE': {
        const deletePayload = payload as DeletePermissionPayload;
        this.removeItemById(deletePayload.id);
        break;
      }
      case 'BATCH': {
        const batchPayload = payload as BatchCreatePermissionsPayload;
        this.applyBatchCreate(batchPayload);
        break;
      }
    }
  }

  /**
   * Tauscht für eine Liste von Server-Permissions die temporären local-IDs
   * gegen die echten Server-IDs aus.
   */
  public replaceIdsByPermission(serverPermissions: Permission[], onMatch?: (localId: string, serverId: string) => void): void {
    this.applyAction((currentPermissions) =>
      currentPermissions.map((localPerm) => {
        // Nur temporäre Objekte prüfen
        if (!localPerm.id.startsWith('local-')) {
          return localPerm;
        }

        // Finde das fachlich passende Server-Objekt
        const matchingServer = serverPermissions.find((serverPerm) => localPerm.isEqualPermission(serverPerm));

        if (matchingServer) {
          // Callback für den QueueService (falls übergeben)
          if (onMatch) {
            onMatch(localPerm.id, matchingServer.id);
          }
          return new Permission({
            ...localPerm,
            id: matchingServer.id
          });
        }

        return localPerm;
      })
    );
  }

  private applyBatchCreate(batchPayload: BatchCreatePermissionsPayload): void {
    const updatedList = [...this.getState()];

    batchPayload.roles.forEach((role) => {
      batchPayload.actions.forEach((action) => {
        const permission = new Permission({
          id: generateLocalId(),
          role,
          resource: batchPayload.resource,
          action,
          targetScope: batchPayload.scope,
          specialization: batchPayload.specialization
        });

        if (!updatedList.some((perm) => perm.isEqualPermission(permission))) {
          updatedList.push(permission);
        }
      });
    });

    this.applyAction(() => updatedList);
  }

  public override restoreFromSnapshot(snapshot: unknown): void {
    if (Array.isArray(snapshot)) {
      const restoredPermissions = snapshot.map((json) => Permission.fromJson(json));
      this.setRawState(restoredPermissions);
    }
  }
}