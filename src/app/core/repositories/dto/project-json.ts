import { IMilestoneJSON } from "./milestone-json";
import { IUserJson } from "./user-json";

export interface IProjectJSON {
  id: string;
  ideaId: string;
  title: string;
  area: string;
  content?: string;
  status: 'Calculation' | 'Active' | 'Zip';
  milestones: IMilestoneJSON[]; // ❌ Kein Fragezeichen! Das Backend liefert IMMER mindestens []
  teamMembers: IUserJson[];     // ❌ Kein Fragezeichen!
}