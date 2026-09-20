import { Injectable, inject, Signal } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { DepartmentRepository } from '../../repositories/department-repository';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { Department } from '../../models/department';
import { generateLocalId } from '../../shared/constants/id-const';
import { DepartmentDeletePayload, DepartmentPayload, DepartmentQueueAction } from '../../models/queue-items/department-queue-payload';
import { DepartmentStateProvider } from './department-state-provider';

@Injectable({
  providedIn: 'root'
})
export class DepartmentDataManager extends BaseQueueDataManager {
  private departmentRepo = inject(DepartmentRepository);

  private static readonly DEPARTMENTS_CACHE_KEY = 'cached_departments';

  constructor() {
    super('DepartmentDataManager');
    this.stateProvider.loadFromCache();
  }

  protected override createStateProvider(): DepartmentStateProvider {
    return new DepartmentStateProvider();
  }

  public get departmentsSignal(): Signal<Department[]> {
    return this.getSignal() as Signal<Department[]>;
  }

  // ==========================================================================
  // ⚙️ QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    switch (item.action as DepartmentQueueAction) {
      case 'CREATE': {
        const payload = item.payload as DepartmentPayload;
        return this.departmentRepo.create$(payload.department.name, payload.department.specialization);
      }
      case 'UPDATE': {
        const payload = item.payload as DepartmentPayload;
        return this.departmentRepo.update$(payload.id, payload.department.name, payload.department.specialization);
      }
      case 'DELETE': {
        const payload = item.payload as DepartmentDeletePayload;
        return this.departmentRepo.delete$(payload.id);
      }
      default:
        return of(null);
    }
  }

  // ==========================================================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // =================================================ONE
  // ==========================================================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.departmentRepo.getAll$().pipe(
      map((departmentsJson) => {
        const departments = departmentsJson.map((d) => Department.fromJson(d));
        const provider = this.stateProvider as DepartmentStateProvider;
        provider.applyActionPayload('SET_DEPARTMENTS', departments);
      })
    );
  }

  // ==========================================================================
  // 🔄 AKTIONEN (Optimistic UI + Queue)
  // ==========================================================================

  public createDepartment(name: string, specialization?: string): void {
    const provider = this.stateProvider as DepartmentStateProvider;
    const tempId = generateLocalId();
    const snapshot = provider.createSnapshot();

    const newDept = new Department({
      id: tempId,
      name,
      specialization
    });

    const payload: DepartmentPayload = {
      id: tempId,
      department: newDept,
      snapshot
    };

      provider.applyActionPayload('CREATE', payload);

    this.queueService.enqueue(this.serviceName, 'CREATE' as DepartmentQueueAction, payload);
  }

  public updateDepartment(id: string, name: string, specialization?: string): void {
    const provider = this.stateProvider as DepartmentStateProvider;
    const snapshot = provider.createSnapshot();
    const updatedDept = new Department({ id, name, specialization });

    const payload: DepartmentPayload = {
      id,
      department: updatedDept,
      snapshot
    };

    provider.applyActionPayload('UPDATE', payload);

    this.queueService.enqueue(this.serviceName, 'UPDATE' as DepartmentQueueAction, payload);
  }

  public deleteDepartment(id: string): void {
    const provider = this.stateProvider as DepartmentStateProvider;
    const snapshot = provider.createSnapshot();

    
    const payload: DepartmentDeletePayload = {
      id,
      snapshot
    };

    provider.applyActionPayload('DELETE', payload);

    this.queueService.enqueue(this.serviceName, 'DELETE' as DepartmentQueueAction, payload);
  }

  // ==========================================================================
  // 🧹 HILFSMETHODEN & BASE DATA MANAGER OVERRIDES
  // ==========================================================================

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    this.stateProvider.resetState()
  }
}