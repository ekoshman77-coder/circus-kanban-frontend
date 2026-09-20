import { IDepartment } from "./deparment-json";

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  department?: IDepartment | null;  // Kommt jetzt sauber mit!
  isApproved: boolean;          // Kommt jetzt sauber mit!
}
