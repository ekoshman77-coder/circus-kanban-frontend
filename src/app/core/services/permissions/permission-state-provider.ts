import { Permission } from '../../models/permission';
import { ArrayStateProvider } from '../central-queue/state-providers/array-state-provider';
import {
  BatchCreatePermissionsPayload, DeletePermissionPayload, PermissionPayload, PermissionQueueAction 
} from '../../models/queue-items/permission-queue-item';
import { generateLocalId, isLocalId } from '../../shared/constants/id-const';

export class PermissionStateProvider extends ArrayStateProvider< Permission > {
  protected override storageKey: string = 'global_permissions_pool';

  // 🎯 Statische Modell-Referenz für generisches Deserialisieren & Cache-Laden
  protected modelStatic = Permission;

  constructor() {
    super([]);
  }

  // 🚀 Einzige Schnittstelle für State-Änderungen über reine Action-Namen & Payloads
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as PermissionQueueAction) {
      case 'SET_PERMISSIONS': {
        const permissions = Array.isArray(payload)
          ? payload.map((p: any) => p instanceof Permission ? p : Permission.fromJson(p))
          : [];
        this.setRawState(permissions);
        break;
      }
      case 'CREATE':
      case 'UPDATE': {
        const createPayload = payload as PermissionPayload;
        if (createPayload?.permission) {
          const permInstance = createPayload.permission instanceof Permission
            ? createPayload.permission
            : Permission.fromJson(createPayload.permission);
          this.addOrUpdateItem(permInstance);
        }
        break;
      }
      case 'DELETE': {
        const deletePayload = payload as DeletePermissionPayload;
        if (deletePayload?.id) {
          this.removeItemById(deletePayload.id);
        }
        break;
      }
      case 'BATCH': {
        const batchPayload = payload as BatchCreatePermissionsPayload;
        if (batchPayload) {
          this.applyBatchCreate(batchPayload);
        }
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
        if (!isLocalId(localPerm.id)) {
          return localPerm;
        }

        const matchingServer = serverPermissions.find((serverPerm) => localPerm.isEqualPermission(serverPerm));

        if (matchingServer) {
          if (onMatch) {
            onMatch(localPerm.id, matchingServer.id);
          }
          // 🛡️ Klonen ohne Prototyp-Verlust via cloneWith
          return localPerm.cloneWith({ id: matchingServer.id });
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
}