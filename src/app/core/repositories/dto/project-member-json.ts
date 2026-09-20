import { IUser } from "./user-dto";

export interface IProjectMemberJSON {
  user: IUser;      // Das nackte, globale User-Modell
  projectRole: string;  // Die spezifische Rolle NUR für dieses Projekt! ('VIEWER', 'OWNER' etc.)
}