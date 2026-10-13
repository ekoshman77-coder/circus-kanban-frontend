import { Component, computed, effect, ElementRef, inject, OnInit, viewChild } from '@angular/core';
import { DepartmentService } from '../../../core/services/admin/department-service';
import { Department } from '../../../core/models/department'; // 👈 Echte Department-Klasse nutzen!
import { ADMIN_DEPARTMENT_NAME } from '../../../core/shared/constants/admin-constants';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MasterDataService } from '../../../core/services/admin/master-data-service';
import { uniqueDepartmentNameValidator } from '../../../core/validators/unique-department-name-validator';

@Component({
  selector: 'app-departments-component',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule], // 👈 ReactiveFormsModule hinzugefügt
  templateUrl: './departments-component.html',
  styleUrl: './departments-component.css',
})
export class DepartmentTabComponent implements OnInit {
  protected departmentService = inject(DepartmentService);
  protected masterDataService = inject(MasterDataService);
  private editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');

  protected readonly ADMIN_DEPT = ADMIN_DEPARTMENT_NAME;

  public departments = computed(() => {
    return this.departmentService.departmentsSorted();
  });

  public specializations = computed(() => this.masterDataService.specializations())

  createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, uniqueDepartmentNameValidator(() => this.departments().map(d => d.name))]
    }),
    specialization: new FormControl<string | null>(null),
  });

  editForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, uniqueDepartmentNameValidator(() => 
        this.departments()
          .filter(d => d.id !== this.editingDepartmentId)
          .map(d => d.name))]
    }),
    specialization: new FormControl<string | null>(null)
  });

  editingDepartmentId: string | null = null;

  ngOnInit(): void {
    
  }

  constructor() {
    // 🟢 Überwacht automatisch, wann das Input erscheint, und fokussiert es!
    effect(() => {
      const inputEl = this.editInput()?.nativeElement;
      if (inputEl) {
        inputEl.focus();
        inputEl.select(); // Bonus: Erleichtert das sofortige Überschreiben!
      }
    });
  }

  public onCreateDepartment(): void {
    if (this.createForm.invalid) return;

    const { name, specialization } = this.createForm.getRawValue();

    this.departmentService.createDepartment(name.trim(), specialization?? undefined);

    this.createForm.reset();
  }

  // 🎯 Geändert: Department-Klasse statt IDepartment!
  public startEdit(dept: Department): void {
    if (!dept || !dept.id || dept.name === this.ADMIN_DEPT) return;

    this.editingDepartmentId = dept.id;

    this.editForm.patchValue({
      name: dept.name,
      specialization: dept.specialization
    });
  }

  public cancelEdit(): void {
    this.editingDepartmentId = null;
    this.editForm.reset();
  }

  public onSaveEdit(): void {
    if (this.editForm.invalid || !this.editingDepartmentId) return;

    const { name, specialization } = this.editForm.getRawValue();
    this.departmentService.updateDepartment(this.editingDepartmentId, name.trim(), specialization?? undefined);

    this.cancelEdit();
  }

  // 🎯 Geändert: Department-Klasse statt IDepartment!
  public onDeleteDepartment(dept: Department): void {
    if (!dept || !dept.id || dept.name === this.ADMIN_DEPT) return;

    if (confirm(`Möchtest du die Abteilung "${dept.name}" wirklich löschen?`)) {
      this.departmentService.deleteDepartment(dept.id);
    }
  }

  // 🎯 Geändert: Department-Klasse statt IDepartment!
  public isEditing(dept: Department): boolean {
    return this.editingDepartmentId === dept.id;
  }
}