import { effect, inject, Injectable, signal } from "@angular/core";
import { CreateRolePermissionDto, RolePermissionResponseDto, UpdateRolePermissionDto } from "../../repositories/dto/role-permissions";
import { BaseDataManager } from "../abstract-base-data-manager/base-data-manager";
import { ConnectionService } from "../connection/connection-service";
import { UserService } from "../user/user-service";
import { Permission } from "../../models/permission";
import { PermissionRepository } from "../../repositories/permission-repository";
import { concat, toArray } from "rxjs";
import { NotificationService } from "../notification/notification-service";
import { generateLocalId } from "../../shared/constants/id-const";

export interface PermissionQueueItem {
    id: string; // Eindeutige Queue-ID
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    payload: RolePermissionResponseDto | CreateRolePermissionDto | UpdateRolePermissionDto | string;
}

@Injectable({
    providedIn: 'root'
})
export class PermissionDataManager extends BaseDataManager {
    private connectionService = inject(ConnectionService);
    private userService = inject(UserService);
    private permissionRepository = inject(PermissionRepository);
    private notificationService = inject(NotificationService);

    private QUEUE_KEY = 'PERMISSIONS_QUEUE_KEY';
    private PERMISSIONS_KEY = 'PERMISSIONS_KEY';

    private localQueue = signal<PermissionQueueItem[]>([]);
    public permissions = signal<Permission[]>([]);

    constructor() {
        super();
        this.loadPermissionsFromStorage();
        this.loadQueueFromStorage();

        effect(() => {
            const isOnline = this.connectionService.isOnline();
            const isAdmin = this.userService.isAdmin();
            if (isOnline && isAdmin) {
                this.syncDataQueue();
            }
        });
    }

    private loadPermissionsFromStorage() {
        const permissionsLocal = this.localStorageService.getItem<Permission[]>(this.PERMISSIONS_KEY) ?? [];
        this.permissions.set(permissionsLocal);
    }

    private loadQueueFromStorage() {
        const queue = this.localStorageService.getItem<PermissionQueueItem[]>(this.QUEUE_KEY) ?? [];
        this.localQueue.set(queue);
    }

    public syncDataQueue() {
        if (this.localQueue().length === 0) return;

        const requests = this.localQueue().map(item => {
            switch (item.action) {
                case 'CREATE':
                    return this.permissionRepository.createPermission(item.payload as CreateRolePermissionDto);
                case 'UPDATE':
                    return this.permissionRepository.updatePermission(item.payload as UpdateRolePermissionDto);
                case 'DELETE':
                    return this.permissionRepository.deletePermission(item.payload as string);
            }
        });

        concat(...requests).pipe(toArray()).subscribe({
            next: () => {
                console.info("Permissions wurden synchronisiert");
                this.localQueue.set([]);
                this.localStorageService.removeItem(this.QUEUE_KEY);
                this.notificationService.showNotification('Alle Offline-Permissionsänderungen wurden synchronisiert. 🔄', 'success');
                this.loadPermissions();
            },
            error: (err) => {
                console.error('❌ Fehler bei der Synchronisation der Offline-Queue:', err);
                this.notificationService.showNotification('Fehler beim Synchronisieren der Permissions.', 'error');
            }
        });
    }

    public loadPermissions() {
        if (this.connectionService.isOffline()) {
            this.loadPermissionsFromStorage();
            return;
        }

        this.permissionRepository.getPermissions().subscribe({
            next: (next) => {
                console.log("Permissions sind von Server geladen", next);
                const list = next.map(permission => Permission.fromJson(permission));
                console.log("Permissions nach dem maping", list);
                this.permissions.set(list);
                this.localStorageService.setItem(this.PERMISSIONS_KEY, list);
            },
            error: (err) => {
                console.error("Fehler beim Laden permissions von Server", err);
                this.notificationService.showNotification("Fehler beim Laden permissions von Server", 'error');
            }
        });
    }

    private copyToQueue(
        perm: CreateRolePermissionDto | UpdateRolePermissionDto | string,
        action: 'CREATE' | 'UPDATE' | 'DELETE'
    ) {
        const permItem: PermissionQueueItem = {
            id: generateLocalId(),
            action: action,
            payload: perm
        };
        this.localQueue.update(value => [...value, permItem]);
        this.localStorageService.setItem(this.QUEUE_KEY, this.localQueue());
    }

    public createPermission(permission: Permission) {
        const permissionJson = permission.mapToJson() as CreateRolePermissionDto;
        const updatedList = [...this.permissions(), permission];

        // Optimistisch lokal setzen
        this.permissions.set(updatedList);
        this.localStorageService.setItem(this.PERMISSIONS_KEY, updatedList);

        if (this.connectionService.isOffline()) {
            this.copyToQueue(permissionJson, 'CREATE');
            return;
        }

        this.permissionRepository.createPermission(permissionJson).subscribe({
            next: (next) => {
                const serverPerm = Permission.fromJson(next);

                // 🎯 Ersetze Punktgenau nur die optimistische Permission anhand ihrer temporären ID
                const perm = this.permissions().map(p =>
                    p.id === permission.id ? serverPerm : p
                );

                this.permissions.set(perm);
                this.localStorageService.setItem(this.PERMISSIONS_KEY, perm);
            },
            error: () => {
                this.copyToQueue(permissionJson, 'CREATE');
            }
        });
    }

    public updatePermission(permission: Permission) {
        const permissionJson = permission.mapToJson() as UpdateRolePermissionDto;
        const updatedList = this.permissions().map(p => p.id === permission.id ? permission : p);

        // Optimistisch lokal setzen
        this.permissions.set(updatedList);
        this.localStorageService.setItem(this.PERMISSIONS_KEY, updatedList);

        if (this.connectionService.isOffline()) {
            this.copyToQueue(permissionJson, 'UPDATE');
            return;
        }

        this.permissionRepository.updatePermission(permissionJson).subscribe({
            error: (err) => {
                console.log("Fehler bei update permission", err);
                this.notificationService.showNotification("Fehler bei update permission", 'error');
                this.copyToQueue(permissionJson, 'UPDATE');
            }
        });
    }

    public deletePermission(permissionId: string) {
        const previousPermissions = [...this.permissions()];
        const updatedList = this.permissions().filter(p => p.id !== permissionId);

        // Optimistisch lokal entfernen
        this.permissions.set(updatedList);
        this.localStorageService.setItem(this.PERMISSIONS_KEY, updatedList);

        if (this.connectionService.isOffline()) {
            this.copyToQueue(permissionId, 'DELETE');
            return;
        }

        this.permissionRepository.deletePermission(permissionId).subscribe({
            error: (err) => {
                console.log("Fehler bei delete permission", err);

                // 🔄 Bei HTTP 403 / 400 (Backend-Sperre) den lokalen State zurückrollen & NICHT in die Queue legen
                this.permissions.set(previousPermissions);
                this.localStorageService.setItem(this.PERMISSIONS_KEY, previousPermissions);

                const errorMsg = err.error?.message || "Fehler beim Löschen der Permission";
                this.notificationService.showNotification(`⛔ ${errorMsg}`, 'error');
            }
        });
    }

    public override checkUnsavedData(): string | null {
        return this.localQueue().length > 0 ? "Permissionsänderungen sind nicht gespeichert" : null;
    }

    public override resetData(): void {
        this.localStorageService.removeItem(this.QUEUE_KEY);
        this.localStorageService.removeItem(this.PERMISSIONS_KEY);
        this.localQueue.set([]);
        this.permissions.set([]);
    }
}