import { IUserJSON } from "./user-json";

export interface IProjectMemberJSON {
  user: IUserJSON;      // Das nackte, globale User-Modell
  projectRole: string;  // Die spezifische Rolle NUR für dieses Projekt! ('VIEWER', 'OWNER' etc.)
}