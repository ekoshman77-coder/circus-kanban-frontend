import { computed, effect, inject, Injectable } from "@angular/core";
import { PermissionDataManager } from "./permission-data-manager";
import { Permission } from "../../models/permission";
import { NotificationService } from "../notification/notification-service";
import { MasterDataService } from "../admin/master-data-service";
import { ADMIN_DEPARTMENT_NAME } from "../../shared/constants/admin-constants";
import { UserService } from "../user/user-service";
import { ConnectionService } from "../connection/connection-service";

export type UIActionIntent =
    'PROJECT_EDIT'
    | 'PROJECT_DELETE'
    | 'TODO_CREATE'
    | 'TODO_EDIT'
    | 'TODO_DELETE'
    | string; // Erlaubt auch dynamische Erweiterungen

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

    private actionIntentRegistry: Record<string, { resource: string; action: string }> = {
        'PROJECT_EDIT': { resource: 'PROJECT', action: 'UPDATE' },
        'PROJECT_DELETE': { resource: 'PROJECT', action: 'DELETE' },
        'PROJECT_VIEW': { resource: 'PROJECT', action: 'READ' },
        'NOTE_CONVERT': { resource: 'NOTE', action: 'EXECUTE' },
        'TODO_UPDATE': { resource: 'TODO', action: 'UPDATE' },
        'TODO_DELETE': { resource: 'TODO', action: 'DELETE' },
    };

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

        // ❌ DIESER ABSCHNITT FÄLLT WEG:
        // const isCritical = this.criticalPermissions().some(...);
        // if (isCritical) { ... return; }

        // Directly execute DataManager -> Server / Queue
        this.permissionDataManager.deletePermission(permissionId);
    }

    public hasPermission(role: string, action: string, resource: string, scope: string): boolean {
        const permission = new Permission({
            role: role,
            action: action,
            resource: resource,
            targetScope: scope
        })
        const found = this.allPermissions().find(perm => perm.isEqualPermission(permission))
        return (!!found)

    }

    /**
     * 🔍 Liefert alle TargetScopes ('RESOURCE', 'PROJECT', 'DEPARTMENT', 'COMPANY'), 
     * auf denen eine Rolle eine Aktion für eine bestimmte Ressource ausführen darf.
     */
    public getAvailableScopesForRoleAction(role: string, action: string, resource: string): string[] {
        return this.allPermissions()
            .filter(perm => perm.role === role && perm.action === action && perm.resource === resource)
            .map(perm => perm.targetScope);
    }

    /**
     * ⚡ Schnellprüfung: Darf die Rolle die Aktion auf MINDESTENS EINEM Scope ausführen?
     */
    public hasPermissionOnAnyScope(role: string, action: string, resource: string): boolean {
        return this.getAvailableScopesForRoleAction(role, action, resource).length > 0;
    }

    /**
     * 🌐 Universeller Rechte-Check für beliebige Ressourcen (PROJECT, TODO, NOTE, USER, DEPARTMENT)
     */
    /**
         * 🌐 Universeller Rechte-Check für beliebige Ressourcen (PROJECT, TODO, NOTE, USER, etc.)
         */
    public canUserPerformAction(
        intent: UIActionIntent,
        context: {
            isOwner?: boolean;
            contextRole?: string;
            systemRole?: string;
        }
    ): boolean {
        // 1. Hole das gemappte Objekt { resource, action }
        const mapped = this.actionIntentRegistry[intent];

        if (!mapped) {
            console.warn(`⚠️ [PermissionService] Unbekannter UI-Intent: '${intent}'. Prüfe das Mapping im Service!`);
            return false;
        }

        const { resource, action } = mapped;

        // 2. Laufzeit-Check gegen MasterData (Developer-Sicherheitsnetz)
        this.validateAgainstMasterData(resource, action);

        // 3. Prüfen: Owner-Rechte
        if (context.isOwner) {
            if (this.hasPermissionOnAnyScope('OWNER', action, resource)) {
                return true;
            }
        }

        // 4. Prüfen: Kontext-Rolle (z.B. PM, DEVELOPER)
        if (context.contextRole) {
            if (this.hasPermissionOnAnyScope(context.contextRole, action, resource)) {
                return true;
            }
        }

        // 5. Prüfen: System-/Abteilungs-Rolle (z.B. DEPARTMENT_HEAD, ADMIN)
        if (context.systemRole) {
            if (this.hasPermissionOnAnyScope(context.systemRole, action, resource)) {
                return true;
            }
        }

        return false;
    }

    private validateAgainstMasterData(resource: string, action: string): void {
        const validResources = this.masterDataService.resources();
        const validActions = this.masterDataService.actions();

        if (validResources.length > 0 && !validResources.includes(resource)) {
            console.error(`🚨 [PermissionService] Ressource '${resource}' existiert nicht in MasterData!`);
        }
        if (validActions.length > 0 && !validActions.includes(action)) {
            console.error(`🚨 [PermissionService] Action '${action}' existiert nicht in MasterData!`);
        }
    }
}