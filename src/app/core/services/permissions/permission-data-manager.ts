import { inject, Injectable, Signal } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { PermissionRepository } from '../../repositories/permission-repository';
import { Permission } from '../../models/permission';
import { QueueItem } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import {
  PermissionQueueAction,
  PermissionPayload,
  DeletePermissionPayload,
  BatchCreatePermissionsPayload
} from '../../models/queue-items/permission-queue-item';
import { PermissionStateProvider } from './permission-state-provider';
import { QueueHandlerName } from '../../enums/queue-handler-name';

@Injectable({
  providedIn: 'root'
})
export class PermissionDataManager extends BaseQueueDataManager {
  private permissionRepository = inject(PermissionRepository);

  constructor() {
    super(QueueHandlerName.PERMISSION);
    (this.stateProvider as PermissionStateProvider).loadFromCache();
  }

  protected override createStateProvider(): PermissionStateProvider {
    return new PermissionStateProvider();
  }

  public get permissionsSignal(): Signal<Permission[]> {
    return this.getSignal() as Signal<Permission[]>;
  }

  // 🎯 Formatiert Berechtigungen in lesbare Strings (z.B. "ADMIN: READ -> USER")
  private formatPermissionTitle(perm: Permission): string {
    const role = perm.role || 'Rolle';
    const action = perm.action || 'Aktion';
    const resource = perm.resource || 'Ressource';
    return `${role} (${action} -> ${resource})`;
  }

  // 🎯 Holt Berechtigung aus Signal für Lösch-Operationen
  private getPermissionTitleById(id: string): string {
    const perm = this.permissionsSignal().find((p) => p.id === id);
    return perm ? this.formatPermissionTitle(perm) : 'Berechtigung';
  }

  // ==========================================
  // 🚀 BASE QUEUE DATA MANAGER HOOKS
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as PermissionQueueAction;
    const payload = item.payload;

    switch (action) {
      case 'CREATE': {
        const createPayload = payload as PermissionPayload;
        const permissionToSend = new Permission({
          ...createPayload.permission,
          id: undefined
        });
        return this.permissionRepository.createPermission(permissionToSend);
      }
      case 'UPDATE': {
        const updatePayload = payload as PermissionPayload;
        return this.permissionRepository.updatePermission(updatePayload.permission);
      }
      case 'DELETE': {
        const deletePayload = payload as DeletePermissionPayload;
        return this.permissionRepository.deletePermission(deletePayload.id);
      }
      case 'BATCH': {
        const batchPayload = payload as BatchCreatePermissionsPayload;
        return this.permissionRepository.batchCreatePermissions(batchPayload);
      }
      default:
        return throwError(() => new Error(`[PermissionDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  protected override handleSuccessResult(item: QueueItem, response: any): void {
    super.handleSuccessResult(item, response);

    if (item.action === 'BATCH' && Array.isArray(response)) {
      const serverPermissions = response.map((json) => Permission.fromJson(json));
      const provider = this.stateProvider as PermissionStateProvider;

      provider.replaceIdsByPermission(serverPermissions, (localId, serverId) => {
        this.queueService.updateEntityIdInQueue(localId, serverId);
      });
    }
  }

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.permissionRepository.getPermissions().pipe(
      map((serverPermissionsJson) => {
        const permissions = serverPermissionsJson.map((json) => Permission.fromJson(json));
        this.stateProvider.applyActionPayload('SET_PERMISSIONS', permissions);
      })
    );
  }

  // ==========================================
  // 📝 PUBLIC API METHODEN (Opt. Updates über Provider)
  // ==========================================

public createPermission(permission: Permission): void {
    const provider = this.stateProvider as PermissionStateProvider;
    const snapshot = provider.createSnapshot();
    const tempId = permission.id || generateLocalId();

    const newPermission = new Permission({
      ...permission,
      id: tempId
    });

    const payload: PermissionPayload = {
      id: tempId,
      permission: newPermission,
      snapshot,
      displayInfo: {
        category: 'Berechtigung anlegen',
        title: this.formatPermissionTitle(newPermission)
      }
    };

    provider.applyActionPayload('CREATE', payload);
    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public updatePermission(permission: Permission): void {
    if (!permission.id) return;

    const provider = this.stateProvider as PermissionStateProvider;
    const snapshot = provider.createSnapshot();

    const payload: PermissionPayload = {
      id: permission.id,
      permission,
      snapshot,
      displayInfo: {
        category: 'Berechtigung anpassen',
        title: this.formatPermissionTitle(permission)
      }
    };

    provider.applyActionPayload('UPDATE', payload);
    this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
  }

  public deletePermission(permissionId: string): void {
    const provider = this.stateProvider as PermissionStateProvider;
    const snapshot = provider.createSnapshot();

    const payload: DeletePermissionPayload = {
      id: permissionId,
      snapshot,
      displayInfo: {
        category: 'Berechtigung löschen',
        title: this.getPermissionTitleById(permissionId)
      }
    };

    provider.applyActionPayload('DELETE', payload);
    this.queueService.enqueue(this.serviceName, 'DELETE', payload);
  }

  public batchCreatePermissions(
    roles: string[],
    actions: string[],
    resource: string,
    scope: string,
    specialization?: string
  ): void {
    const provider = this.stateProvider as PermissionStateProvider;
    const snapshot = provider.createSnapshot();

    const payload: BatchCreatePermissionsPayload = {
      id: generateLocalId(),
      roles,
      resource,
      actions,
      scope,
      specialization,
      snapshot,
      displayInfo: {
        category: 'Massen-Berechtigung',
        title: `${resource} (${roles.length} Rollen, ${actions.length} Aktionen)`
      }
    };

    provider.applyActionPayload('BATCH', payload);
    this.queueService.enqueue(this.serviceName, 'BATCH', payload);
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}
