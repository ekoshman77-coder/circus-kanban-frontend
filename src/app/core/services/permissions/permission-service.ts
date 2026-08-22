import { computed, inject, Injectable } from "@angular/core";
import { PermissionDataManager } from "./permission-data-manager";
import { Permission } from "../../models/permission";
import { NotificationService } from "../notification/notification-service";
import { MasterDataService } from "../admin/master-data-service";

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
    private permissionDataManager = inject(PermissionDataManager);
    private notificationService = inject(NotificationService);
    private masterDataService = inject(MasterDataService);

    public allPermissions = this.permissionDataManager.permissions; 

    // Dynamische Berechnung der kritischen Admin-Permissions basierend auf Signals
    public criticalPermissions = computed(() => {
        const adminRoles = this.masterDataService.departmentRoles().filter(role => role.toUpperCase().includes('ADMIN'));
        const actions = this.masterDataService.actions();
        const criticalList: Permission[] = [];

        adminRoles.forEach(role => {
            for (let action of actions) {
                criticalList.push(new Permission({
                   role: role,
                   resource: 'PERMISSION',
                   action: action,
                   targetScope: "",
                }));
            }
        });
        return criticalList;
    });

    constructor() {
        this.permissionDataManager.loadPermissions();
    }

    public createPermission(permission: Permission) {
        if (this.allPermissions().some(perm => perm.isEqualPermission(permission))) {
            console.error("Permission existiert schon", permission); 
            this.notificationService.showNotification(
                `Permission für ${permission.role} - ${permission.action} - ${permission.resource} existiert schon.`, 'error'
            );
            return;
        }
        this.permissionDataManager.createPermission(permission); 
    }

    public updatePermission(permission: Permission) {
        const existing = this.allPermissions().find(perm => perm.id === permission.id);
        if (!existing) {
            console.error("Permission kann nicht aktualisiert werden: ID nicht gefunden", permission); 
            this.notificationService.showNotification(
                `Permission konnte nicht aktualisiert werden: Existiert nicht.`, 'error'
            );
            return;
        }
        
        // Aufruf korrigiert: updatePermission statt createPermission
        this.permissionDataManager.updatePermission(permission);
    }

    public deletePermission(permissionId: string) {
        const deleted = this.allPermissions().find(perm => perm.id === permissionId);
        if (!deleted) {
            console.error("Permission existiert nicht", permissionId); 
            this.notificationService.showNotification(
                `Permission mit ID ${permissionId} existiert nicht.`, 'error'
            );
            return;
        }

        // Prüfung gegen die dynamischen criticalPermissions
        const isCritical = this.criticalPermissions().some(critical => deleted.isEqualPermission(critical));
        if (isCritical) {
            console.error(`Permission für ${deleted.role} auf ${deleted.resource} ist kritisch und kann nicht gelöscht werden.`); 
            this.notificationService.showNotification(
                `System-Schutz: Kritische Admin-Berechtigung (${deleted.role} -> ${deleted.resource}) darf nicht gelöscht werden!`, 'error'
            );
            return;
        }

        this.permissionDataManager.deletePermission(permissionId);
    }
}