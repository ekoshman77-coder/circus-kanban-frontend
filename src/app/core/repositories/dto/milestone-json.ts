import { User } from "../../models/user";

export type TodoTeamStatus = 'Offen' | 'In Arbeit' | 'Erledigt';

export interface IMilestoneJSON {
  id: string;
  title: string;
  duration: number;
  usedDuration: number;
  status: TodoTeamStatus; // 'Offen' | 'In Arbeit' | 'Erledigt'
  assignedUserId?: string | null;
  assignedUser?: User | null; // Falls du das voll aufgelöste User-Objekt hast
  projectId?: string | null;     // 📁 NEU: Die Verbindung zum Projekt für unser Backend!
}
