import { Component, computed, inject } from '@angular/core';
import { DepartmentService } from '../../../core/services/admin/department-service';
import { IDepartment } from '../../../core/repositories/department-repository';
import { ADMIN_DEPARTMENT_NAME } from '../../../core/shared/constants/admin-constants';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-departments-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './departments-component.html',
  styleUrl: './departments-component.css',
})
export class DepartmentTabComponent {
  // Wir holen uns den Service
  protected departmentService = inject(DepartmentService);
  
  // Den Namen der Admin-Abteilung für das Template bereitstellen
  protected readonly ADMIN_DEPT = ADMIN_DEPARTMENT_NAME;

  // Zustand für das Formular "Neue Abteilung"
  newDepartmentName = '';

  // Zustand für das Editieren einer bestehenden Abteilung
  editingDepartmentId: string | null = null;
  editingName = '';

  // 💡 HIER OPTIMIERT: Kein doppeltes computed() mehr nötig. 
  // Wir nutzen direkt das Signal aus dem Service.
  public departments = computed(() => {
    return this.departmentService.departments().sort((a,b) => a.name.localeCompare(b.name));
  }) 

  public onCreateDepartment() {
    const newName = this.newDepartmentName.trim();
    if (!newName) return;

    // Validierung mit Rückmeldung
    const exists = this.departments().some(dep => dep.name.toLowerCase() === newName.toLowerCase());
    if (exists) {
      alert(`Die Abteilung "${newName}" existiert bereits!`);
      return;
    }

    this.departmentService.createDepartment(newName);
    this.newDepartmentName = "";
  }

  public startEdit(dept: IDepartment) {
    // Schutz: Admin-Abteilung darf nicht editiert werden!
    if (!dept || !dept.id || dept.name === this.ADMIN_DEPT) return;
    
    this.editingDepartmentId = dept.id;
    this.editingName = dept.name;
  }

  public cancelEdit() {
    this.editingDepartmentId = null;
    this.editingName = "";
  }

  public onSaveEdit() {
    const trimmedName = this.editingName.trim();
    if (!trimmedName || !this.editingDepartmentId) return;

    // Validierung: Gibt es den Namen schon bei einer *anderen* Abteilung?
    const exists = this.departments().some(
      dep => dep.name.toLowerCase() === trimmedName.toLowerCase() && dep.id !== this.editingDepartmentId
    );
    
    if (exists) {
      alert(`Eine andere Abteilung heißt bereits "${trimmedName}"!`);
      return;
    }

    this.departmentService.updateDepartment(this.editingDepartmentId, trimmedName);
    this.cancelEdit(); // Nutzt die bestehende Bereinigungsmethode
  }

  public onDeleteDepartment(dept: IDepartment) {
    if (!dept || !dept.id || dept.name === this.ADMIN_DEPT) return;

    if (confirm(`Möchtest du die Abteilung "${dept.name}" wirklich löschen?`)) {
      this.departmentService.deleteDepartment(dept.id);
    }
  }

  public idEditing(dept: IDepartment): boolean {
    return this.editingDepartmentId === dept.id;
  }
}