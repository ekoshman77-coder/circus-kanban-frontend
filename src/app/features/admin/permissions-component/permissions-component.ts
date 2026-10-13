import { Component, computed, inject, signal } from '@angular/core';
import { PermissionService } from '../../../core/services/permissions/permission-service';
import { Permission } from '../../../core/models/permission';
import { MasterDataService } from '../../../core/services/admin/master-data-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { BatchPermissionModalComponent } from './batch-permission-modal-component/batch-permission-modal-component';

export type SortDirection = 'down' | 'up' | null;

export interface Sorting {
  roleSortDirection?: SortDirection;
  actionSortDirection?: SortDirection;
  resourceSortDirection?: SortDirection;
}

export interface PermissionGroup {
  key: string;
  role: string;
  resource: string;
  action: string;
  activePermissions: Map<string, Permission>; 
}

@Component({
  selector: 'app-permissions-component',
  standalone: true,
  imports: [UniversalPopupComponent, BatchPermissionModalComponent],
  templateUrl: './permissions-component.html',
  styleUrl: './permissions-component.css',
})
export class PermissionsComponent {
  private permissionService = inject(PermissionService);
  public masterDataService = inject(MasterDataService);
  public notificationService = inject(NotificationService);

  public allPermissions = computed(() => this.permissionService.allPermissions());
  public targetScopes = this.masterDataService.allScopes;
  public roles = this.masterDataService.allRoles;
  public actions = this.masterDataService.actions;
  public resources = this.masterDataService.resources;
  public specializations = this.masterDataService.specializations;

  // Filter Signals
  public selectedRole = signal<string | null>(null);
  public selectedAction = signal<string | null>(null);
  public selectedResource = signal<string | null>(null);
  public selectedSpec = signal<string | null>(null);

  public sortPermissions = signal<Sorting>({});
  
  // Modal Control Signal
  public isBatchModalOpen = signal<boolean>(false);

  public pendingPermissionToToggle = signal<{ perm?: Permission; group: PermissionGroup; scope: string } | null>(null);

  /**
   * 🎯 Gruppiert alle Permissions nach Rolle + Ressource + Aktion
   */
  public displayedGroups = computed(() => {
    let rawList = this.allPermissions();

    // Filtern nach Spezialisierung
    rawList = rawList.filter(perm => {
      if (!this.selectedSpec()) {
         return !perm.specialization;
      }
      return perm.specialization === this.selectedSpec();
    });
    
    // Rollen / Action / Resource Filter
    if (this.selectedRole()) {
      rawList = rawList.filter(perm => perm.role === this.selectedRole());
    }
    if (this.selectedAction()) {
      rawList = rawList.filter(perm => perm.action === this.selectedAction());
    }
    if (this.selectedResource()) {
      rawList = rawList.filter(perm => perm.resource === this.selectedResource());
    }

    // Gruppieren nach (Rolle + Ressource + Aktion)
    const groupMap = new Map<string, PermissionGroup>();

    for (const perm of rawList) {
      const groupKey = `${perm.role}|${perm.resource}|${perm.action}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          role: perm.role,
          resource: perm.resource,
          action: perm.action,
          activePermissions: new Map<string, Permission>()
        });
      }
      groupMap.get(groupKey)!.activePermissions.set(perm.targetScope, perm);
    }

    const groups = Array.from(groupMap.values());

    // Sortieren
    const sorting = this.sortPermissions();
    return groups.sort((g1, g2) => {
      if (sorting.roleSortDirection) {
        const comp = g1.role.localeCompare(g2.role);
        if (comp !== 0) return sorting.roleSortDirection === 'down' ? comp : -comp;
      }
      if (sorting.resourceSortDirection) {
        const comp = g1.resource.localeCompare(g2.resource);
        if (comp !== 0) return sorting.resourceSortDirection === 'down' ? comp : -comp;
      }
      if (sorting.actionSortDirection) {
        const comp = g1.action.localeCompare(g2.action);
        if (comp !== 0) return sorting.actionSortDirection === 'down' ? comp : -comp;
      }
      return 0;
    });
  });

  public toggleSort(column: 'role' | 'action' | 'resource') {
    this.sortPermissions.update(current => {
      const key = `${column}SortDirection` as keyof Sorting;
      const currentDir = current[key];
      let nextDir: SortDirection = 'down';

      if (currentDir === 'down') nextDir = 'up';
      else if (currentDir === 'up') nextDir = null;

      return { ...current, [key]: nextDir };
    });
  }

  /**
   * 🎯 Scope-Pills in der Tabelle direkt umschalten
   */
  public onScopeToggle(group: PermissionGroup, scope: string) {
    const existingPerm = group.activePermissions.get(scope);

    if (existingPerm) {
      if (scope === 'COMPANY') {
        this.pendingPermissionToToggle.set({ perm: existingPerm, group, scope });
      } else {
        this.permissionService.deletePermission(existingPerm.id!);
      }
    } else {
      const newPerm = new Permission({
        role: group.role,
        resource: group.resource,
        action: group.action,
        targetScope: scope,
        specialization: this.selectedSpec() ?? undefined
      });
      this.permissionService.createPermission(newPerm);
    }
  }

  public confirmToggle(data: { perm?: Permission; group: PermissionGroup; scope: string } | null) {
    if (data && data.perm) {
      this.permissionService.deletePermission(data.perm.id!);
    }
    this.pendingPermissionToToggle.set(null);
  }

  public onDeleteGroup(group: PermissionGroup) {
    group.activePermissions.forEach(perm => {
      this.permissionService.deletePermission(perm.id!);
    });
  }
}