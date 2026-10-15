import { Department } from "../../models/department";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";
import {
  DepartmentDeletePayload,
  DepartmentPayload,
  DepartmentQueueAction
} from "../../models/queue-items/department-queue-payload";

export class DepartmentStateProvider extends ArrayStateProvider< Department > {
  protected override storageKey = 'cached_departments';
  protected modelStatic = Department;

  constructor() {
    super([]);
  }

  // 🚀 Einzige Schnittstelle für State-Änderungen über reine Action-Namen & Payloads
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as DepartmentQueueAction) {
      case 'SET_DEPARTMENTS': {
        const departments = Array.isArray(payload)
          ? payload.map((d: any) => d instanceof Department ? d : Department.fromJson(d))
          : [];
        this.setRawState(departments);
        break;
      }
      case 'CREATE':
      case 'UPDATE': {
        const deptPayload = payload as DepartmentPayload;
        const deptInstance = deptPayload.department instanceof Department
          ? deptPayload.department
          : Department.fromJson(deptPayload.department);

        this.addOrUpdateItem(deptInstance);
        break;
      }
      case 'DELETE': {
        const deletePayload = payload as DepartmentDeletePayload;
        this.removeItemById(deletePayload.id);
        break;
      }
    }
  }
}