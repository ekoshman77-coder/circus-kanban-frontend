import { DomainModel } from "../../models/domain-model";
import { generateLocalId } from "../../shared/constants/id-const";

export interface IAdminTodoFilterJson {
  departmentId?: string;
  projectId?: string;
  targetUserId?: string;
  isArchived: boolean;
  fromDate?: number;
  toDate?: number;
  onlySensitive: boolean;
}

export class AdminTodoFilter implements DomainModel<AdminTodoFilter> {
  id: string;
  departmentId: string | null;
  projectId: string | null;
  targetUserId: string | null;
  isArchived: boolean;
  fromDate: number | null;
  toDate: number | null;
  onlySensitive: boolean;

  constructor(init: IAdminTodoFilterJson) {
    this.id = generateLocalId();
    this.departmentId = init.departmentId?? null;
    this.projectId = init.projectId?? null;
    this.isArchived = init.isArchived;
    this.fromDate = init.fromDate?? null;
    this.toDate = init.toDate?? null;
    this.targetUserId = init.targetUserId?? null;
    this.onlySensitive = init.onlySensitive;
  }
  
  toJson(): IAdminTodoFilterJson {
    return {
      departmentId: this.departmentId?? undefined,
      projectId: this.projectId?? undefined,
      isArchived: this.isArchived,
      fromDate: this.fromDate?? undefined,
      toDate: this.toDate?? undefined,
      targetUserId: this.targetUserId?? undefined,
      onlySensitive: this.onlySensitive
    }
  }

  public cloneWith(changes: Partial<AdminTodoFilter>): AdminTodoFilter {
    return new AdminTodoFilter({
      departmentId: changes.departmentId?? this.departmentId?? undefined,
      projectId:  changes.projectId?? this.projectId?? undefined,
      isArchived: changes.isArchived?? this.isArchived,
      toDate: changes.toDate?? this.toDate?? undefined,
      fromDate: changes.fromDate ?? this.fromDate ?? undefined,
      targetUserId: changes.targetUserId?? this.targetUserId?? undefined,
      onlySensitive: changes.onlySensitive?? this.onlySensitive
    })
  }
  
  public static fromJson(init: IAdminTodoFilterJson) {
    return new AdminTodoFilter(init)
  }
  
  public isValid() {
     return this.projectId || this.targetUserId || this.isArchived || this.departmentId || this.onlySensitive;
  }
}