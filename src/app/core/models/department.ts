import { IDepartment } from "../repositories/dto/deparment-json";
import { ADMIN_DEPARTMENT_NAME } from "../shared/constants/admin-constants";
import { generateLocalId } from "../shared/constants/id-const";
import { DomainModel } from "./domain-model";

export class Department implements DomainModel< Department > {
  public id: string;
  public name: string;
  public specialization?: string;

  constructor(init: {name: string, id?: string, specialization?: string}) {
    this.id = init.id ?? generateLocalId();
    this.name = init.name || '';
    this.specialization = init.specialization;
  }

  // 🛡️ Neu für das DomainModel-Interface!
  public cloneWith(changes: Partial< Department >): Department {
    return new Department({
      id: changes.id ?? this.id,
      name: changes.name ?? this.name,
      specialization: changes.specialization !== undefined ? changes.specialization : this.specialization
    });
  }

  // 👑 Domänen-Logik
  public isAdmin(): boolean {
    return this.name.trim().toLowerCase() === ADMIN_DEPARTMENT_NAME.toLowerCase();
  }

  public getInitials(): string {
    const trimmed = this.name.trim();
    if (!trimmed) return '??';
    
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return trimmed.substring(0, 2).toUpperCase();
  }

  public getColorHash(): string {
    if (!this.name) return '#cbd5e1';
    let hash = 0;
    for (let i = 0; i < this.name.length; i++) {
      hash = (hash * 31) + this.name.charCodeAt(i);
      hash = (hash << 5) - hash + (this.name.charCodeAt(i) * 12345);
    }
    const h = Math.abs(hash * 777) % 360;
    return `hsl(${h}, 65%, 85%)`;
  }

  public static fromJson(department: IDepartment): Department {
    return new Department(department);
  }

  public toJson(): IDepartment {
    return {
      id: this.id,
      name: this.name,
      specialization: this.specialization
    };
  }
}