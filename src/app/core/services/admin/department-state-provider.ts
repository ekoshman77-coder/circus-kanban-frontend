import { Department } from "../../models/department";
import { IDepartment } from "../../repositories/dto/deparment-json";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";
import { LocalStorageService } from "../user/local-storage-service";
import {
    DepartmentDeletePayload,
  DepartmentPayload,
  DepartmentQueueAction
} from "../../models/queue-items/department-queue-payload";

export class DepartmentStateProvider extends ArrayStateProvider<Department> {
  protected override storageKey = 'cached_departments';
    
  constructor() {
    super([]);
  }

  public loadFromCache(): void {
    const cached = this.localStorageService.getItem(this.storageKey);
    if (cached && Array.isArray(cached)) {
      const restored = (cached as IDepartment[]).map((json) => Department.fromJson(json));
      this.setRawState(restored);
    }
  }

  // 🚀 Einzige Schnittstelle für State-Änderungen über reine Action-Namen & Payloads
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as DepartmentQueueAction) {
      case 'SET_DEPARTMENTS': {
        const departments = payload as Department[];
        this.setRawState(departments);
        break;
      }
      case 'CREATE':
      case 'UPDATE': {
        const deptPayload = payload as DepartmentPayload;
        this.addOrUpdateItem(deptPayload.department);
        break;
      }
      case 'DELETE': {
        const deletePayload = payload as DepartmentDeletePayload;
        this.removeItemById(deletePayload.id);
        break;
      }
    }
  }

  public override restoreFromSnapshot(snapshot: unknown): void {
    const depts = (snapshot as Department[]).map(department => new Department(department))
    this.setRawState(depts)
  }
}