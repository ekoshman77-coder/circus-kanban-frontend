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
  public notificationService = inject(NotificationService)
  public formBuilder = inject(FormBuilder)

  public allPermissions = computed(() => this.permissionService.allPermissions());
  public targetScopes = this.masterDataService.allScopes
  public roles = this.masterDataService.allRoles
  public actions = this.masterDataService.actions
  public resources = this.masterDataService.resources

  public createForm = this.formBuilder.group({
    role: ["", Validators.required],
    action: ["", Validators.required],
    resource: ["", Validators.required],
    targetScope: ['', Validators.required]
  })
  
  // Filter- & Sortier-Zustände
  public selectedRole = signal<string | null>(null);
  public selectedAction = signal<string | null>(null);
  public selectedResource = signal<string | null>(null);
  public sortPermissions = signal<Sorting>({});

  public isCreateOpen = signal<boolean>(false);

  // 🎯 Zustände für das Universal-Popup
  public pendingPermissionToCreate = signal<Permission | null>(null);
  public pendingPermissionIdToDelete = signal<string | null>(null);

  /**
   * Filtert und sortiert die Liste für die Anzeige
   */
  public displayedPermissions = computed(() => {
    let result = this.allPermissions();

    // 1. Filtern
    if (this.selectedRole()) {
      result = result.filter(perm => perm.role === this.selectedRole());
    }
    if (this.selectedAction()) {
      result = result.filter(perm => perm.action === this.selectedAction());
    }
    if (this.selectedResource()) {
      result = result.filter(perm => perm.resource === this.selectedResource());
    }

    // 2. Sortieren
    const sorted = [...result];
    const sorting = this.sortPermissions();

    return sorted.sort((p1, p2) => {
      if (sorting.roleSortDirection) {
        const comp = p1.role.localeCompare(p2.role);
        if (comp !== 0) return sorting.roleSortDirection === 'down' ? comp : -comp;
      }
      if (sorting.actionSortDirection) {
        const comp = p1.action.localeCompare(p2.action);
        if (comp !== 0) return sorting.actionSortDirection === 'down' ? comp : -comp;
      }
      if (sorting.resourceSortDirection) {
        const comp = p1.resource.localeCompare(p2.resource);
        if (comp !== 0) return sorting.resourceSortDirection === 'down' ? comp : -comp;
      }
      return 0;
    });
  });

  // Umschalten der Sortierrichtung
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
    // 🛡️ VOLLSTÄNDIGKEITSPRÜFUNG: Wenn ein Feld leer ist, sofort abbrechen!
    if (this.createForm.invalid) {
      this.notificationService.showNotification('Bitte alle 4 Felder (Rolle, Ressource, Aktion, Scope) auswählen!', 'error');
      return;
    }
    const formValues = this.createForm.value;
    const newPerm = new Permission({
      role: formValues.role?? "",
      action: formValues.action?? "",
      resource: formValues.resource?? "",
      targetScope: formValues.targetScope?? ""
    });

    this.pendingPermissionToCreate.set(newPerm);
  }

  // 🟢 Bestätigung aus dem Erstellen-Popup
  public confirmCreate(permission: Permission | null) {
    if (permission) {
      this.permissionService.createPermission(permission);
      this.createForm.reset()
    }
    
    this.pendingPermissionToCreate.set(null);
  }

// Signal für das Update-Popup
public pendingPermissionToUpdate = signal<{ perm: Permission; newScope: string } | null>(null);

public onUpdate(perm: Permission, newScope: string) {
  // Falls sich gar nichts geändert hat
  if (perm.targetScope === newScope) return;

  // Hier definieren wir, was als "Einschränkung / Rechteverlust" gilt
  const isRestricting = perm.targetScope === 'ALL' || (perm.targetScope === 'DEPARTMENT' && newScope === 'OWN');

  if (isRestricting) {
    // ⚠️ Bei Einschränkung: Popup verlangen!
    this.pendingPermissionToUpdate.set({ perm, newScope });
  } else {
    // 🟢 Lockerung oder gewöhnliche Änderung: Direkt ausführen
    perm.targetScope = newScope;
    this.permissionService.updatePermission(perm);
  }
}

public confirmUpdate(data: { perm: Permission; newScope: string } | null) {
  if (data) {
    data.perm.targetScope = data.newScope;
    this.permissionService.updatePermission(data.perm);
  }
  this.pendingPermissionToUpdate.set(null);
}
  // 🗑️ Wird vom HTML gerufen: Öffnet das Löschen-Popup
  public onDelete(permissionId: string) {
    this.pendingPermissionIdToDelete.set(permissionId);
  }

  // 🔴 Bestätigung aus dem Löschen-Popup
  public confirmDelete(permissionId: string | null) {
    if (permissionId) {
      this.permissionService.deletePermission(permissionId);
    }
    this.pendingPermissionIdToDelete.set(null);
  }

  public toggleCreateForm() {
    this.isCreateOpen.update(open => !open);
  }
}