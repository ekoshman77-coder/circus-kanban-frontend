import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { DepartmentRepository } from '../../repositories/department-repository';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { Department } from '../../models/department';
import { IDepartment } from '../../repositories/dto/deparment-json';
import { generateLocalId } from '../../shared/constants/id-const';
import {
  DepartmentPayload,
  DeleteDepartmentPayload
} from '../../models/queue-items/department-queue-payload';

export type DepartmentAction = 'CREATE_DEPARTMENT' | 'UPDATE_DEPARTMENT' | 'DELETE_DEPARTMENT';

@Injectable({
  providedIn: 'root'
})
export class DepartmentDataManager extends BaseQueueDataManager {
  private departmentRepo = inject(DepartmentRepository);

  public departmentsSignal = signal<Department[]>([]);
  private static readonly DEPARTMENTS_CACHE_KEY = 'cached_departments';

  constructor() {
    super('DepartmentDataManager');
    this.loadCache();
  }

  // ==========================================================================
  // ⚙️ QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    switch (item.action as DepartmentAction) {
      case 'CREATE_DEPARTMENT': {
        const payload = item.payload as DepartmentPayload;
        // 🛡️ Bereinigung: Wir senden KEINE temporäre ID an das Backend!
        return this.departmentRepo.create$(payload.department.name, payload.department.specialization);
      }
      case 'UPDATE_DEPARTMENT': {
        const payload = item.payload as DepartmentPayload;
        return this.departmentRepo.update$(payload.id, payload.department.name, payload.department.specialization);
      }
      case 'DELETE_DEPARTMENT': {
        const payload = item.payload as DeleteDepartmentPayload;
        return this.departmentRepo.delete$(payload.id);
      }
      default:
        return of(null);
    }
  }

  // ==========================================================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.departmentRepo.getAll$().pipe(
      map((departmentsJson) => {
        const departments = departmentsJson.map((d) => Department.fromJson(d));
        this.departmentsSignal.set(departments);
        this.saveCache(departments);
      })
    );
  }

  public override resetState(snapshot: IDepartment[]): void {
    if (Array.isArray(snapshot)) {
      const restoredList = snapshot.map((json) => Department.fromJson(json));
      this.departmentsSignal.set(restoredList);
      this.saveCache(restoredList);
    }
  }

  protected override onEntityCreated(tempId: string, response: any): void {
    const realId = response.id || response;
    this.departmentsSignal.update((list) => {
      const updated = list.map((dept) => {
        if (dept.id === tempId) {
          return new Department({ ...dept, id: realId });
        }
        return dept;
      });
      this.saveCache(updated);
      return updated;
    });
  }

  // ==========================================================================
  // 🔄 AKTIONEN (Optimistic UI + Queue)
  // ==========================================================================

  public createDepartment(name: string, specialization?: string): void {
    const tempId = generateLocalId();
    const snapshot = this.createSnapshot();

    const newDept = new Department({
      id: tempId,
      name,
      specialization
    });

    this.departmentsSignal.update((current) => {
      const updated = [...current, newDept];
      this.saveCache(updated);
      return updated;
    });

    const payload: DepartmentPayload = {
      id: tempId,
      department: newDept,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'CREATE_DEPARTMENT' as DepartmentAction, payload);
  }

  public updateDepartment(id: string, name: string, specialization?: string): void {
    const snapshot = this.createSnapshot();

    const updatedDept = new Department({ id, name, specialization });

    this.departmentsSignal.update((current) => {
      const updated = current.map((dept) => (dept.id === id ? updatedDept : dept));
      this.saveCache(updated);
      return updated;
    });

    const payload: DepartmentPayload = {
      id,
      department: updatedDept,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'UPDATE_DEPARTMENT' as DepartmentAction, payload);
  }

  public deleteDepartment(id: string): void {
    const snapshot = this.createSnapshot();

    this.departmentsSignal.update((current) => {
      const updated = current.filter((dept) => dept.id !== id);
      this.saveCache(updated);
      return updated;
    });

    const payload: DeleteDepartmentPayload = {
      id,
      snapshot
    };

    this.queueService.enqueue(this.serviceName, 'DELETE_DEPARTMENT' as DepartmentAction, payload);
  }

  // ==========================================================================
  // 🧹 HILFSMETHODEN & BASE DATA MANAGER OVERRIDES
  // ==========================================================================

  private createSnapshot(): IDepartment[] {
    return this.departmentsSignal().map((dept) => dept.toJson());
  }

  private saveCache(departments: Department[]): void {
    const jsonList = departments.map((d) => d.toJson());
    this.localStorageService.setItem(DepartmentDataManager.DEPARTMENTS_CACHE_KEY, jsonList);
  }

  private loadCache(): void {
    const cached = this.localStorageService.getItem(DepartmentDataManager.DEPARTMENTS_CACHE_KEY);
    if (cached && Array.isArray(cached)) {
      this.departmentsSignal.set(cached.map((json) => Department.fromJson(json)));
    }
  }

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.departmentsSignal.set([]);
    this.localStorageService.removeItem(DepartmentDataManager.DEPARTMENTS_CACHE_KEY);
  }
}