import { Injectable, inject, Signal } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { DepartmentRepository } from '../../repositories/department-repository';
import { BaseQueueDataManager } from '../central-queue/base-queue-data-manager';
import { QueueItem } from '../../models/queue-items/queue-item';
import { Department } from '../../models/department';
import { generateLocalId } from '../../shared/constants/id-const';
import {
  DepartmentDeletePayload,
  DepartmentPayload,
  DepartmentQueueAction
} from '../../models/queue-items/department-queue-payload';
import { DepartmentStateProvider } from './department-state-provider';
import { QueueHandlerName } from '../../enums/queue-handler-name';

@Injectable({
  providedIn: 'root'
})
export class DepartmentDataManager extends BaseQueueDataManager {
  private departmentRepo = inject(DepartmentRepository);

  constructor() {
    super(QueueHandlerName.DEPARTMENT);
    this.stateProvider.loadFromCache();
  }

  protected override createStateProvider(): DepartmentStateProvider {
    return new DepartmentStateProvider();
  }

  public get departmentsSignal(): Signal<Department[]> {
    return this.getSignal() as Signal<Department[]>;
  }

  private getDepartmentNameById(id: string): string {
    const department = this.departmentsSignal().find(dep => dep.id === id) ?? null;
    return department ? department.name : 'Unbenannte Abteilung';
  }

  // ==========================================================================
  // ⚙️ QUEUE HANDLER IMPLEMENTIERUNG
  // ==========================================================================

  public override executeQueueItem(item: QueueItem): Observable<any> {
    const action = item.action as DepartmentQueueAction;

    switch (action) {
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
        return throwError((): Error => new Error(`[DepartmentDataManager] Unbekannte Action: ${item.action}`));
    }
  }

  // ==========================================================================
  // 🔄 REHYDRATION PATTERN (BaseQueueDataManager)
  // ==========================================================================

  protected override fetchFromServer(userId: string): Observable<void> {
    return this.departmentRepo.getAll$().pipe(
      map((departmentsJson): void => {
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
      snapshot,
      displayInfo: {
        category: 'Abteilung erzeugen',
        title: name // z. B. "Max Mustermann" statt einer hässlichen UUID!
      }
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
      snapshot,
      displayInfo: {
        category: 'Abteilung bearbeiten', // 🎯 Sauber vereinheitlicht
        title: name
      }
    };

    provider.applyActionPayload('UPDATE', payload);
    this.queueService.enqueue(this.serviceName, 'UPDATE' as DepartmentQueueAction, payload);
  }

  public deleteDepartment(id: string): void {
    const provider = this.stateProvider as DepartmentStateProvider;
    const snapshot = provider.createSnapshot();

    const payload: DepartmentDeletePayload = {
      id,
      snapshot,
      displayInfo: {
        category: 'Abteilung löschen',
        title: this.getDepartmentNameById(id)
      }
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
    this.stateProvider.resetState();
  }
}