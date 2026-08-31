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

  /**
   * Generiert 2 Initialen aus dem Abteilungsnamen.
   * "Software Development" -> "SD"
   * "Marketing" -> "MA"
   */
  public getInitials(): string {
    const trimmed = this.name.trim();
    if (!trimmed) return '??';
    
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return trimmed.substring(0, 2).toUpperCase();
  }

  /**
   * Errechnet eine verlässliche Pastellfarbe basierend auf dem Namen.
   */
  public getColorHash(): string {
    if (!this.name) return '#cbd5e1';
    let hash = 0;
    for (let i = 0; i < this.name.length; i++) {
      hash = (hash * 31) + this.name.charCodeAt(i);
      hash = (hash << 5) - hash + (this.name.charCodeAt(i) * 12345);
    }
    const h = Math.abs(hash * 777) % 360;
    return `hsl(${h}, 65%, 85%)`; // Angenehme Pastellfarbe
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