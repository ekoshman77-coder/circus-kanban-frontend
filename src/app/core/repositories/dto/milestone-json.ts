import { UserModel } from "../../models/user-model";

export type TodoTeamStatus = 'Offen' | 'In Arbeit' | 'Erledigt';

export interface IMilestoneJSON {
  id: string;
  title: string;
  duration: number;
  usedDuration: number;
  status: TodoTeamStatus; // 'Offen' | 'In Arbeit' | 'Erledigt'
  assignedUserId?: string | null;
  assignedUser?: UserModel | null; // Falls du das voll aufgelöste User-Objekt hast
  projectId?: string | null;     // 📁 NEU: Die Verbindung zum Projekt für unser Backend!
  orderIndex?: number;
}
