import { IDepartment } from "../repositories/department-repository";
import { ADMIN_DEPARTMENT_NAME } from "../shared/constants/admin-constants";
import { generateLocalId } from "../shared/constants/id-const";

export class Department {
  public id: string;
  public name: string;
  public scope: string;

  constructor(init: {name: string, scope: string, id?: string}) {
    // Generiert eine temporäre UUID oder nutzt die Server-ID
    this.id = init.id ?? generateLocalId();
    this.name = init.name || '';
    this.scope = init.scope || 'DEPARTMENT';
  }

  // 👑 Domänen-Logik direkt am Objekt!
  public isAdmin(): boolean {
    return this.name.trim().toLowerCase() === ADMIN_DEPARTMENT_NAME.toLowerCase();
  }

  public static fromJson(department: IDepartment): Department {
     return new Department(
        department
     )
  }

  public toJson(): IDepartment {
    return {...this}
  }
}