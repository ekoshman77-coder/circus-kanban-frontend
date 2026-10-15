import { IDepartment } from "../repositories/dto/deparment-json";
import { generateLocalId } from "../shared/constants/id-const";
import { Department } from "./department";
import { DomainModel } from "./domain-model";
import { IUser } from "../repositories/dto/user-dto";

export type ProjectRole = 'OWNER' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'NONE';

export interface CoffeeAccount {
  balance: number;
  role: string;
  emoji: string;
}

export interface IUserInit {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  department: Department | IDepartment | null;
  departmentRole?: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
  isApproved: boolean | null;
  projectIds: string[];
  coffeeAccount?: CoffeeAccount;
}

export class UserModel implements DomainModel<UserModel> {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  department: Department | null;
  departmentRole: string;
  supervisorId: string | null;
  supervisorName: string | null;
  isApproved: boolean | null;
  projectIds: string[];
  coffeeAccount: CoffeeAccount;

  constructor(data: IUserInit) {
    this.id = data.id || generateLocalId();
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.username = data.username || '';

    if (data.department instanceof Department) {
      this.department = data.department;
    } else if (data.department) {
      this.department = Department.fromJson(data.department);
    } else {
      this.department = null;
    }

    this.departmentRole = data.departmentRole || '';
    this.supervisorId = data.supervisorId ?? null;
    this.supervisorName = data.supervisorName ?? null;
    this.isApproved = data.isApproved ?? null;
    this.projectIds = data.projectIds || [];

    this.coffeeAccount = {
      balance: data.coffeeAccount?.balance ?? 0,
      role: data.coffeeAccount?.role ?? 'Teammitglied',
      emoji: data.coffeeAccount?.emoji ?? '🦊'
    };
  }

  public cloneWith(changes: Partial<UserModel>): UserModel {
    return new UserModel({
      id: changes.id ?? this.id,
      firstName: changes.firstName ?? this.firstName,
      lastName: changes.lastName ?? this.lastName,
      username: changes.username ?? this.username,
      department: changes.department !== undefined ? changes.department : this.department,
      departmentRole: changes.departmentRole ?? this.departmentRole,
      supervisorId: changes.supervisorId !== undefined ? changes.supervisorId : this.supervisorId,
      supervisorName: changes.supervisorName !== undefined ? changes.supervisorName : this.supervisorName,
      isApproved: changes.isApproved !== undefined ? changes.isApproved : this.isApproved,
      projectIds: changes.projectIds ?? this.projectIds,
      coffeeAccount: changes.coffeeAccount ?? { ...this.coffeeAccount }
    });
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  getInitials(): string {
    const first = this.firstName.charAt(0) || '';
    const last = this.lastName.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  }

  getColorHash(): string {
    if (!this.username) return '#cbd5e1';
    let hash = 0;
    for (let i = 0; i < this.username.length; i++) {
      hash = (hash * 31) + this.username.charCodeAt(i);
      hash = (hash << 5) - hash + (this.username.charCodeAt(i) * 12345);
    }
    const spreadValue = Math.abs(hash * 777);
    const h = spreadValue % 360;
    return `hsl(${h}, 70%, 75%)`;
  }

  public isAdmin(): boolean {
    return this.department?.isAdmin() ?? false;
  }

  /** 🧪 Prüft, ob der User gezwungen im Labor-Modus ist */
  public isLaborForced(): boolean {
    const role = this.departmentRole.toUpperCase();
    return role === 'INTERN' || role === 'GUEST' || role === 'PRAKTIKANT';
  }

  public static fromJson(json: IUser): UserModel {
    return new UserModel({
      id: json.id,
      firstName: json.firstName,
      lastName: json.lastName,
      username: json.username,
      isApproved: json.isApproved,
      department: json.department ? Department.fromJson(json.department) : null,
      departmentRole: json.departmentRole || '',
      supervisorId: json.supervisorId || null,
      supervisorName: json.supervisorName || null,
      projectIds: json.projectIds || [],
      coffeeAccount: {
        balance: json.coffeeAccount?.balance ?? 0,
        role: json.coffeeAccount?.role ?? 'Teammitglied',
        emoji: json.coffeeAccount?.emoji ?? '🦊'
      }
    });
  }

  public toJson(): IUser {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      username: this.username,
      department: this.department ? this.department.toJson() : null,
      departmentRole: this.departmentRole,
      supervisorId: this.supervisorId,
      supervisorName: this.supervisorName,
      isApproved: this.isApproved ?? false,
      projectIds: this.projectIds,
      coffeeAccount: this.coffeeAccount
    };
  } 
}