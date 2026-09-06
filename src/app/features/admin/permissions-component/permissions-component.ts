import { Component, computed, inject, signal } from '@angular/core';
import { PermissionService } from '../../../core/services/permissions/permission-service';
import { Permission } from '../../../core/models/permission';
import { MasterDataService } from '../../../core/services/admin/master-data-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

export type SortDirection = 'down' | 'up' | null;

export interface Sorting {
  roleSortDirection?: SortDirection;
  actionSortDirection?: SortDirection;
  resourceSortDirection?: SortDirection;
}

// 🎯 Neue Struktur für die Gruppierung in der UI
export interface PermissionGroup {
  key: string; // z.B. "ADMIN|USER|READ"
  role: string;
  resource: string;
  action: string;
  // Map von Scope zu Permission-Objekt (oder undefined falls nicht vergeben)
  activePermissions: Map<string, Permission>; 
}

@Component({
  selector: 'app-permissions-component',
  standalone: true,
  imports: [UniversalPopupComponent, ReactiveFormsModule, FormsModule],
  templateUrl: './permissions-component.html',
  styleUrl: './permissions-component.css',
})
export class PermissionsComponent {
  private permissionService = inject(PermissionService);
  public masterDataService = inject(MasterDataService);
  public notificationService = inject(NotificationService);
  public formBuilder = inject(FormBuilder);

  public allPermissions = computed(() => this.permissionService.allPermissions());
  public targetScopes = this.masterDataService.allScopes;
  public roles = this.masterDataService.allRoles;
  public actions = this.masterDataService.actions;
  public resources = this.masterDataService.resources;
  public specializations = this.masterDataService.specializations;

  public createForm = this.formBuilder.group({
    role: ["", Validators.required],
    action: ["", Validators.required],
    resource: ["", Validators.required],
    targetScope: ['', Validators.required]
  });

  public selectedRole = signal<string | null>(null);
  public selectedAction = signal<string | null>(null);
  public selectedResource = signal<string | null>(null);
  public selectedSpec = signal<string | null>(null);

  public sortPermissions = signal<Sorting>({});
  
  public isCreateOpen = signal<boolean>(false);

  public pendingPermissionToCreate = signal<Permission | null>(null);
  public pendingPermissionIdToDelete = signal<string | null>(null);
  public pendingPermissionToToggle = signal<{ perm?: Permission; group: PermissionGroup; scope: string } | null>(null);

  /**
   * 🎯 Gruppiert alle Permissions nach Rolle + Ressource + Aktion
   */
  public displayedGroups = computed(() => {
    let rawList = this.allPermissions();

    // filtern für spezifikation
    rawList = rawList.filter(perm => {
      if (!this.selectedSpec()) {
         return !perm.specialization
      }
              
      return (perm.specialization === this.selectedSpec()) 
    })
    
    // 1. Filtern
    if (this.selectedRole()) {
      rawList = rawList.filter(perm => perm.role === this.selectedRole());
    }
    if (this.selectedAction()) {
      rawList = rawList.filter(perm => perm.action === this.selectedAction());
    }
    if (this.selectedResource()) {
      rawList = rawList.filter(perm => perm.resource === this.selectedResource());
    }

    // 2. Gruppieren nach (Rolle + Ressource + Aktion)
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

    // 3. Sortieren
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

  public onSubmitCreate() {
    if (this.createForm.invalid) {
      this.notificationService.showNotification('Bitte alle 4 Felder wählen!', 'error');
      return;
    }
    const formValues = this.createForm.value;
    const newPerm = new Permission({
      role: formValues.role ?? "",
      action: formValues.action ?? "",
      resource: formValues.resource ?? "",
      targetScope: formValues.targetScope ?? "",
      specialization: this.selectedSpec()?? undefined
    });

    this.pendingPermissionToCreate.set(newPerm);
  }

  public confirmCreate(permission: Permission | null) {
    if (permission) {
      this.permissionService.createPermission(permission);
      this.createForm.reset();
    }
    this.pendingPermissionToCreate.set(null);
  }

  /**
   * 🎯 Klick auf Scope-Pill: Aktivieren (Hinzufügen) oder Deaktivieren (Löschen)
   */
  public onScopeToggle(group: PermissionGroup, scope: string) {
    const existingPerm = group.activePermissions.get(scope);

    if (existingPerm) {
      // Deaktivieren / Löschen (evtl. mit Bestätigung falls COMPANY)
      if (scope === 'COMPANY') {
        this.pendingPermissionToToggle.set({ perm: existingPerm, group, scope });
      } else {
        this.permissionService.deletePermission(existingPerm.id!);
      }
    } else {
      // Neu Anlegen für diesen Scope
      const newPerm = new Permission({
        role: group.role,
        resource: group.resource,
        action: group.action,
        targetScope: scope,
        specialization: this.selectedSpec()?? undefined
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

  // 🗑️ Löscht alle Scopes einer ganzen Zeile/Gruppe
  public onDeleteGroup(group: PermissionGroup) {
    group.activePermissions.forEach(perm => {
      this.permissionService.deletePermission(perm.id!);
    });
  }

  public toggleCreateForm() {
    this.isCreateOpen.update(open => !open);
  }

  public getCreatePopupMessage(): string {
  const perm = this.pendingPermissionToCreate();
  if (!perm) return '';

  const specLabel = perm.specialization 
    ? `<b>${perm.specialization}</b>` 
    : '<i>🌐 Global (Alle Abteilungen)</i>';

  return `
    Möchtest du folgende Berechtigung wirklich anlegen?<br><br>
    <b>Kontext:</b> ${specLabel}<br>
    <b>Rolle:</b> ${perm.role}<br>
    <b>Ressource:</b> ${perm.resource}<br>
    <b>Aktion:</b> ${perm.action}<br>
    <b>Scope:</b> ${perm.targetScope}
  `;
  }
}