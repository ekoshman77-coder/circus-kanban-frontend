import { Injectable, inject, computed } from '@angular/core';
import { DepartmentDataManager } from './department-data-manager';
import { UserService } from '../user/user-service';
import { ADMIN_DEPARTMENT_NAME } from '../../shared/constants/admin-constants';

@Injectable({
  providedIn: 'root',
})
export class DepartmentService {
  private departmentDataManager = inject(DepartmentDataManager);
  private userService = inject(UserService);

  public departments = computed(() => this.departmentDataManager.departmentsSignal());

  public isAdmin = computed(() => {
    const currentDept = this.userService.currentUser()?.department;
    if (!currentDept) return false;

    return currentDept.name.toLowerCase() === ADMIN_DEPARTMENT_NAME.toLowerCase();
  });

  public departmentsSorted = computed(() => {
    return this.departments().toSorted((a, b) => {
      if (a.isAdmin()) return -1;
      if (b.isAdmin()) return 1;
      return a.name.localeCompare(b.name);
    });
  });

  public createDepartment(name: string, specialisation?: string): void {
    this.departmentDataManager.createDepartment(name, specialisation);
  }

  public updateDepartment(id: string, newName: string, specialisation?: string): void {
    this.departmentDataManager.updateDepartment(id, newName, specialisation);
  }

  public deleteDepartment(id: string): void {
    this.departmentDataManager.deleteDepartment(id);
  }
}