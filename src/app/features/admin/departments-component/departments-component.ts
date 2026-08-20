import { Component, computed, inject, OnInit } from '@angular/core';
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

  protected readonly ADMIN_DEPT = ADMIN_DEPARTMENT_NAME;

  public departments = computed(() => {
    return this.departmentService.departments().sort((a, b) => a.name.localeCompare(b.name));
  });

  public departmentScopes = computed(() => this.masterDataService.departmentScopes());

  createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, uniqueDepartmentNameValidator(() => this.departments().map(d => d.name))]
    }),
    scope: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  editForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, uniqueDepartmentNameValidator(() => 
        this.departments()
          .filter(d => d.id !== this.editingDepartmentId)
          .map(d => d.name))]
    }),
    scope: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  editingDepartmentId: string | null = null;

  ngOnInit(): void {
    
  }

  public onCreateDepartment(): void {
    if (this.createForm.invalid) return;

    const { name, scope } = this.createForm.getRawValue();
    this.departmentService.createDepartment(name.trim(), scope);

    this.createForm.reset();
  }

  // 🎯 Geändert: Department-Klasse statt IDepartment!
  public startEdit(dept: Department): void {
    if (!dept || !dept.id || dept.name === this.ADMIN_DEPT) return;

    this.editingDepartmentId = dept.id;

    this.editForm.patchValue({
      name: dept.name,
      scope: dept.scope
    });
  }

  public cancelEdit(): void {
    this.editingDepartmentId = null;
    this.editForm.reset();
  }

  public onSaveEdit(): void {
    if (this.editForm.invalid || !this.editingDepartmentId) return;

    const { name, scope } = this.editForm.getRawValue();
    this.departmentService.updateDepartment(this.editingDepartmentId, name.trim(), scope);

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