import { computed, effect, inject, Injectable } from "@angular/core";
import { PermissionDataManager } from "./permission-data-manager";
import { Permission } from "../../models/permission";
import { NotificationService } from "../notification/notification-service";
import { MasterDataService } from "../admin/master-data-service";
import { ADMIN_DEPARTMENT_NAME } from "../../shared/constants/admin-constants";
import { UserService } from "../user/user-service";
import { ConnectionService } from "../connection/connection-service";

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
    private permissionDataManager = inject(PermissionDataManager);
    private notificationService = inject(NotificationService);
    private masterDataService = inject(MasterDataService);
    private userService = inject(UserService)
    private connectionService = inject(ConnectionService)

    public allPermissions = this.permissionDataManager.permissions; 

    // Dynamische Berechnung der kritischen Admin-Permissions basierend auf Signals
    public criticalPermissions = computed(() => {
        const adminRoles = this.masterDataService.departmentRoles().filter(role => role.toUpperCase().includes("ADMIN"));
        const actions = this.masterDataService.actions();
        const criticalList: Permission[] = [];

        adminRoles.forEach(role => {
            for (let action of actions) {
                criticalList.push(new Permission({
                   role: role,
                   resource: 'PERMISSION',
                   action: action,
                   targetScope: 'COMPANY',
                }));
            }
        });
        return criticalList;
    });

    constructor() {
        // 🔄 Lädt bei jedem Login und nach Re-Connects sauber die Berechtigungen neu
        effect(() => {
            if (this.userService.isLoggedIn() && this.connectionService.isOnline()) {
                this.permissionDataManager.loadPermissions();
            }
        });
    }

    /**
     * Prüft, ob alle 4 Felder gesetzt sind und in den offiziellen MasterData-Listen existieren.
     */
    private validatePermissionFields(permission: Permission): boolean {
        const validRoles = this.masterDataService.allRoles();
        const validResources = this.masterDataService.resources();
        const validActions = this.masterDataService.actions();
        const validScopes = this.masterDataService.allScopes();

        if (!permission.role || !validRoles.includes(permission.role)) {
            this.showValidationError(`Ungültige oder fehlende Rolle: '${permission.role}'`);
            return false;
        }

        if (!permission.resource || !validResources.includes(permission.resource)) {
            this.showValidationError(`Ungültige oder fehlende Ressource: '${permission.resource}'`);
            return false;
        }

        if (!permission.action || !validActions.includes(permission.action)) {
            this.showValidationError(`Ungültige oder fehlende Action: '${permission.action}'`);
            return false;
        }

        if (!permission.targetScope || !validScopes.includes(permission.targetScope)) {
            this.showValidationError(`Ungültiger oder fehlender TargetScope: '${permission.targetScope}'`);
            return false;
        }

        return true;
    }

    private showValidationError(message: string) {
        console.error("Permission Validation Error:", message);
        this.notificationService.showNotification(message, 'error');
    }

    public createPermission(permission: Permission) {
        // 1. Strikte MasterData-Prüfung aller 4 Felder
        if (!this.validatePermissionFields(permission)) {
            return;
        }

        // 2. Duplikatsprüfung über die unikalen 4 Felder
        if (this.allPermissions().some(perm => perm.isEqualPermission(permission))) {
            console.error("Permission existiert schon", permission); 
            this.notificationService.showNotification(
                `Permission für ${permission.role} - ${permission.action} - ${permission.resource} [${permission.targetScope}] existiert schon.`, 'error'
            );
            return;
        }

        this.permissionDataManager.createPermission(permission); 
    }

public updatePermission(permission: Permission) {
        // 1. Strikte MasterData-Prüfung aller 4 Felder
        if (!this.validatePermissionFields(permission)) {
            return;
        }

        const existing = this.allPermissions().find(perm => perm.id === permission.id);
        if (!existing) {
            console.error("Permission kann nicht aktualisiert werden: ID nicht gefunden", permission); 
            this.notificationService.showNotification(
                `Permission konnte nicht aktualisiert werden: Existiert nicht.`, 'error'
            );
            return;
        }
        
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

        const isCritical = this.criticalPermissions().some(critical => deleted.isEqualPermission(critical));
        if (isCritical) {
            console.error(`Permission für ${deleted.role} auf ${deleted.resource} [${deleted.targetScope}] ist kritisch und kann nicht gelöscht werden.`); 
            this.notificationService.showNotification(
                `System-Schutz: Kritische Admin-Berechtigung (${deleted.role} -> ${deleted.resource} [${deleted.targetScope}]) darf nicht gelöscht werden!`, 'error'
            );
            return;
        }

        this.permissionDataManager.deletePermission(permissionId);
    }
}