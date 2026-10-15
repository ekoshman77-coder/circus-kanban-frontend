import { inject, Injectable } from '@angular/core';
import { PermissionDataManager } from './permission-data-manager';
import { Permission } from '../../models/permission';
import { NotificationService } from '../notification/notification-service';
import { MasterDataService } from '../admin/master-data-service';

export type UIActionIntent =
  | 'PROJECT_EDIT'
  | 'PROJECT_DELETE'
  | 'PROJECT_VIEW'
  | 'NOTE_CONVERT'
  | 'TODO_CREATE'
  | 'TODO_EDIT'
  | 'TODO_UPDATE'
  | 'TODO_DELETE'
  | string;

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private permissionDataManager = inject(PermissionDataManager);
  private notificationService = inject(NotificationService);
  private masterDataService = inject(MasterDataService);

  public readonly allPermissions = this.permissionDataManager.permissionsSignal;

  private actionIntentRegistry: Record<string, { resource: string; action: string }> = {
    PROJECT_EDIT: { resource: 'PROJECT', action: 'UPDATE' },
    PROJECT_DELETE: { resource: 'PROJECT', action: 'DELETE' },
    PROJECT_VIEW: { resource: 'PROJECT', action: 'READ' },
    NOTE_CONVERT: { resource: 'NOTE', action: 'EXECUTE' },
    TODO_UPDATE: { resource: 'TODO', action: 'UPDATE' },
    TODO_DELETE: { resource: 'TODO', action: 'DELETE' }
  };

  /**
   * Prüft, ob alle Pflichtfelder gesetzt sind und in den offiziellen MasterData-Listen existieren.
   */
  private validatePermissionFields(permission: Permission): boolean {
    const validRoles = this.masterDataService.allRoles();
    const validResources = this.masterDataService.resources();
    const validActions = this.masterDataService.actions();
    const validScopes = this.masterDataService.allScopes();
    const validSpec = this.masterDataService.specializations();

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

    if (permission.specialization && !validSpec.includes(permission.specialization)) {
      this.showValidationError(`Ungültige oder fehlende Spezialisierung: '${permission.specialization}'`);
      return false;
    }

    return true;
  }

  private validateFields(
    roles: string[],
    actions: string[],
    resource: string,
    scope: string,
    specialization?: string
  ): boolean {
    const validRoles = this.masterDataService.allRoles();
    const validResources = this.masterDataService.resources();
    const validActions = this.masterDataService.actions();
    const validScopes = this.masterDataService.allScopes();
    const validSpec = this.masterDataService.specializations();

    const wrongRole = roles.find((role) => !role || !validRoles.includes(role));
    if (wrongRole) {
      this.showValidationError(`Ungültige oder fehlende Rolle: '${wrongRole}'`);
      return false;
    }

    const wrongAction = actions.find((action) => !action || !validActions.includes(action));
    if (wrongAction) {
      this.showValidationError(`Ungültige oder fehlende Action: '${wrongAction}'`);
      return false;
    }

    if (!resource || !validResources.includes(resource)) {
      this.showValidationError(`Ungültige oder fehlende Ressource: '${resource}'`);
      return false;
    }

    if (!scope || !validScopes.includes(scope)) {
      this.showValidationError(`Ungültiger oder fehlender TargetScope: '${scope}'`);
      return false;
    }

    if (specialization && !validSpec.includes(specialization)) {
      this.showValidationError(`Ungültige oder fehlende Spezialisierung: '${specialization}'`);
      return false;
    }

    return true;
  }

  private showValidationError(message: string): void {
    console.error('Permission Validation Error:', message);
    this.notificationService.showNotification(message, 'error');
  }

  public createPermission(permission: Permission): void {
    if (!this.validatePermissionFields(permission)) {
      return;
    }

    if (this.allPermissions().some((perm) => perm.isEqualPermission(permission))) {
      console.error('Permission existiert bereits', permission);
      this.notificationService.showNotification(
        `Permission für ${permission.role} - ${permission.action} - ${permission.resource} [${permission.targetScope}] existiert bereits.`,
        'error'
      );
      return;
    }

    this.permissionDataManager.createPermission(permission);
  }

  public batchCreatePermission(
    roles: string[],
    actions: string[],
    resource: string,
    scope: string,
    specialization?: string
  ): void {
    if (!this.validateFields(roles, actions, resource, scope, specialization)) {
      return;
    }

    this.permissionDataManager.batchCreatePermissions(roles, actions, resource, scope, specialization);
  }

  public updatePermission(permission: Permission): void {
    if (!this.validatePermissionFields(permission)) {
      return;
    }

    const existing = this.allPermissions().find((perm) => perm.id === permission.id);
    if (!existing) {
      console.error('Permission kann nicht aktualisiert werden: ID nicht gefunden', permission);
      this.notificationService.showNotification(
        'Permission konnte nicht aktualisiert werden: Existiert nicht.',
        'error'
      );
      return;
    }

    this.permissionDataManager.updatePermission(permission);
  }

  public deletePermission(permissionId: string): void {
    const deleted = this.allPermissions().find((perm) => perm.id === permissionId);
    if (!deleted) {
      console.error('Permission existiert nicht', permissionId);
      this.notificationService.showNotification(
        `Permission mit ID ${permissionId} existiert nicht.`,
        'error'
      );
      return;
    }

    this.permissionDataManager.deletePermission(permissionId);
  }

  public hasPermission(role: string, action: string, resource: string, scope: string): boolean {
    const permission = new Permission({
      role: role,
      action: action,
      resource: resource,
      targetScope: scope
    });
    const found = this.allPermissions().find((perm) => perm.isEqualPermission(permission));
    return !!found;
  }

  /**
   * 🔍 Liefert alle TargetScopes ('RESOURCE', 'PROJECT', 'DEPARTMENT', 'COMPANY'),
   * auf denen eine Rolle eine Aktion für eine bestimmte Ressource ausführen darf.
   */
  public getAvailableScopesForRoleAction(role: string, action: string, resource: string): string[] {
    return this.allPermissions()
      .filter((perm) => perm.role === role && perm.action === action && perm.resource === resource)
      .map((perm) => perm.targetScope);
  }

  /**
   * ⚡ Schnellprüfung: Darf die Rolle die Aktion auf MINDESTENS EINEM Scope ausführen?
   */
  public hasPermissionOnAnyScope(role: string, action: string, resource: string): boolean {
    return this.getAvailableScopesForRoleAction(role, action, resource).length > 0;
  }

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
    const mapped = this.actionIntentRegistry[intent];

    if (!mapped) {
      console.warn(`⚠️ [PermissionService] Unbekannter UI-Intent: '${intent}'. Prüfe das Mapping im Service!`);
      return false;
    }

    const { resource, action } = mapped;

    this.validateAgainstMasterData(resource, action);

    if (context.isOwner && this.hasPermissionOnAnyScope('OWNER', action, resource)) {
      return true;
    }

    if (context.contextRole && this.hasPermissionOnAnyScope(context.contextRole, action, resource)) {
      return true;
    }

    if (context.systemRole && this.hasPermissionOnAnyScope(context.systemRole, action, resource)) {
      return true;
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