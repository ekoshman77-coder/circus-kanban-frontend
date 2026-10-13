import { IDepartment } from "./deparment-json";

export interface ICoffeeAccountDto {
  balance: number;
  emoji: string;
  role: string;
}

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  department?: IDepartment | null;
  departmentRole?: string | null;     // 'INTERN', 'GUEST', 'MEMBER', 'ADMIN'
  supervisorId?: string | null;       // 👈 NEU: Betreuer-ID für Praktikanten
  supervisorName?: string | null;     // 👈 NEU: Betreuer-Name
  isApproved: boolean;
  projectIds?: string[];
  coffeeAccount?: ICoffeeAccountDto;  // 👈 Sauber gekapseltes Objekt vom Server
}