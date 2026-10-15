import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MasterDataService } from '../../../../core/services/admin/master-data-service';
import { PermissionService } from '../../../../core/services/permissions/permission-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { T } from '@angular/cdk/keycodes';
import { UniversalPopupComponent } from '../../../../core/shared/components/universal-popup-component/universal-popup-component';

@Component({
  selector: 'app-batch-permission-modal',
  imports: [ReactiveFormsModule, UniversalPopupComponent],
  templateUrl: './batch-permission-modal-component.html',
  styleUrl: './batch-permission-modal-component.css',
})
export class BatchPermissionModalComponent {
  private fb = inject(FormBuilder);
  public masterDataService = inject(MasterDataService);
  private permissionService = inject(PermissionService);

  public currentSpecialization = input<string | null>(null);
  public close = output<void>();

  showConfirmPopup = signal<boolean>(false);

  // 1. Dein Formular (Reine FormControls für alles)
  public form = this.fb.group({
    resource: ['', Validators.required],
    targetScope: ['', Validators.required],
    specialization: [''],
    roles: [[] as string[], [Validators.required, Validators.minLength(1)]],
    actions: [[] as string[], [Validators.required, Validators.minLength(1)]]
  });

  // ⚡ 2. Das Gesamte Formular AUTOMATISCH in ein Signal verwandeln
  // Dadurch löst JEDE Änderung im Formular (Klick, Select-All, Reset) sofort Updates aus!
  public formState = toSignal(this.form.valueChanges, {
    initialValue: this.form.value
  });

  constructor() {
    effect(() => {
      this.form.patchValue({
        specialization: this.currentSpecialization() ?? ''
      });
    });
  }

  // 🎯 3. Live-Zähler berechnen sich AUTOMATISCH aus dem Formular-Signal
  public selectedRolesCount = computed(() => this.formState().roles?.length ?? 0);
  public selectedActionsCount = computed(() => this.formState().actions?.length ?? 0);

  public previewCount = computed(() => {
    return this.selectedRolesCount() * this.selectedActionsCount();
  });

  // Checkbox Toggle Helpers (Setzen NUR das Formular – die Signals reagieren automatisch!)
  public toggleRole(role: string): void {
    const current = this.form.controls.roles.value ?? [];
    const updated = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];

    this.form.controls.roles.setValue(updated);
  }

  public toggleAction(action: string): void {
    const current = this.form.controls.actions.value ?? [];
    const updated = current.includes(action)
      ? current.filter(a => a !== action)
      : [...current, action];

    this.form.controls.actions.setValue(updated);
  }

  // Quick-Select Helpers (Kein Zähler-Update mehr nötig!)
  public selectAllRoles(): void {
    this.form.controls.roles.setValue([...this.masterDataService.allRoles()]);
  }

  public clearAllRoles(): void {
    this.form.controls.roles.setValue([]);
  }

  public selectAllActions(): void {
    this.form.controls.actions.setValue([...this.masterDataService.actions()]);
  }

  public clearAllActions(): void {
    this.form.controls.actions.setValue([]);
  }

  public onClose(): void {
    this.showConfirmPopup.set(false);
    this.form.reset();
    this.close.emit();
  }

  public onSubmit(): void {
    if (this.form.invalid) return;

    this.showConfirmPopup.set(true);
  }

  onConfirmSave(): void {
    const val = this.form.value;
    this.permissionService.batchCreatePermission(
      val.roles!,
      val.actions!,
      val.resource!,
      val.targetScope!,
      val.specialization || undefined
    );
    
    this.onClose(); // Haupt-Modal schließen
  }

  // 3. Abbrechen im UniversalPopup
  onCancelConfirm(): void {
    this.showConfirmPopup.set(false)
  }

}