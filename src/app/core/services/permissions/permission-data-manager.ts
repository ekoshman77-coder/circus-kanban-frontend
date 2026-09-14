import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, throwError, map } from 'rxjs';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { PermissionRepository } from '../../repositories/permission-repository';
import { Permission } from '../../models/permission';
import { QueueItem } from '../../models/queue-items/queue-item';
import { generateLocalId } from '../../shared/constants/id-const';
import { PermissionJson } from '../../repositories/dto/permission-json';
import {
  PermissionPayload,
  DeletePermissionPayload,
  BatchCreatePermissionsPayload
} from '../../models/queue-items/permission-queue-item';

export type PermissionQueueAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'BATCH';

@Injectable({
  providedIn: 'root'
})
export class PermissionDataManager extends BaseQueueDataManager {
  private permissionRepository = inject(PermissionRepository);

  public permissionsSignal = signal< Permission[]>([]);
  private readonly STORAGE_KEY = 'global_permissions_pool';

  constructor() {
    super('PermissionDataManager');
    this.loadFromCache();
  }

  // ==========================================
  // 🚀 BASE QUEUE DATA MANAGER HOOKS
  // ==========================================

  public override executeQueueItem(item: QueueItem): Observable< any> {
    const action = item.action as PermissionQueueAction;
    const payload = item.payload;

    switch (action) {
      case 'CREATE': {
        const createPayload = payload as PermissionPayload;
        // 🛡️ Security: Backend soll eigene ID vergeben -> Local ID entfernen
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
        return throwError((): Error => new Error(`[PermissionDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  public override resetState(snapshot: PermissionJson[]): void {
    if (Array.isArray(snapshot)) {
      const restored = snapshot.map((json: PermissionJson) => Permission.fromJson(json));
      this.permissionsSignal.set(restored);
      this.saveToCache(restored);
    }
  }

  protected override onEntityCreated(tempId: string, response: unknown): void {
    const realPermission = Permission.fromJson(response);
    const updated = this.permissionsSignal().map((p) => (p.id === tempId ? realPermission : p));
    this.permissionsSignal.set(updated);
    this.saveToCache(updated);
  }

  // ==========================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================

  protected override fetchFromServer(userId: string): Observable< void> {
    return this.permissionRepository.getPermissions().pipe(
      map((serverPermissionsJson): void => {
        const permissions = serverPermissionsJson.map((json) => Permission.fromJson(json));
        this.permissionsSignal.set(permissions);
        this.saveToCache(permissions);
      })
    );
  }

  // ==========================================
  // 📝 PUBLIC API METHODEN (mit Snapshots)
  // ==========================================

  public createPermission(permission: Permission): void {
    const snapshot = this.getSnapshotJson();
    const tempId = permission.id || generateLocalId();

    const newPermission = new Permission({
      ...permission,
      id: tempId
    });

    const updated = [...this.permissionsSignal(), newPermission];
    this.permissionsSignal.set(updated);
    this.saveToCache(updated);

    const payload: PermissionPayload = {
      id: tempId,
      permission: newPermission,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'CREATE', payload);
  }

  public batchCreatePermissions(
    roles: string[],
    actions: string[],
    resource: string,
    scope: string,
    specialization?: string
  ): void {
    const snapshot = this.getSnapshotJson();
    const updatedList = [...this.permissionsSignal()];

    roles.forEach((role) => {
      actions.forEach((action) => {
        const permission = new Permission({
          id: generateLocalId(),
          role,
          resource,
          action,
          targetScope: scope,
          specialization
        });
        if (!updatedList.some((perm) => perm.isEqualPermission(permission))) {
          updatedList.push(permission);
        }
      });
    });

    this.permissionsSignal.set(updatedList);
    this.saveToCache(updatedList);

    const payload: BatchCreatePermissionsPayload = {
      id: generateLocalId(),
      roles,
      resource,
      actions,
      scope,
      specialization,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'BATCH', payload);
  }

  public updatePermission(permission: Permission): void {
    if (!permission.id) return;

    const snapshot = this.getSnapshotJson();
    const updated = this.permissionsSignal().map((p) => (p.id === permission.id ? permission : p));

    this.permissionsSignal.set(updated);
    this.saveToCache(updated);

    const payload: PermissionPayload = {
      id: permission.id,
      permission,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
  }

  public deletePermission(permissionId: string): void {
    const snapshot = this.getSnapshotJson();
    const updated = this.permissionsSignal().filter((p) => p.id !== permissionId);

    this.permissionsSignal.set(updated);
    this.saveToCache(updated);

    const payload: DeletePermissionPayload = {
      id: permissionId,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE', payload);
  }

  // ==========================================
  // 🛠️ PRIVATE CACHE HELPER
  // ==========================================

  private getSnapshotJson(): PermissionJson[] {
    return this.permissionsSignal().map((p) => p.mapToJson());
  }

  private saveToCache(permissions: Permission[]): void {
    const jsonArray = permissions.map((p) => p.mapToJson());
    this.localStorageService.setItem(this.STORAGE_KEY, jsonArray);
  }

  private loadFromCache(): void {
    const cached = this.localStorageService.getItem< PermissionJson[]>(this.STORAGE_KEY);
    if (cached && Array.isArray(cached)) {
      const restored = cached.map((json) => Permission.fromJson(json));
      this.permissionsSignal.set(restored);
    } else {
      this.permissionsSignal.set([]);
    }
  }

  public override resetData(): void {
    this.localStorageService.removeItem(this.STORAGE_KEY);
    this.permissionsSignal.set([]);
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}