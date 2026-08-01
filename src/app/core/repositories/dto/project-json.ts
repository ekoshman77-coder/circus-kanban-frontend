import { IUser } from "../user-repository";
import { IMilestoneJSON } from "./milestone-json";

export interface IProjectJSON {
  id: string;
  ideaId: string;
  title: string;
  area: string;
  content?: string;
  status: 'Calculation' | 'Active' | 'Zip';
  departmentId: string;
  milestones: IMilestoneJSON[]; // ❌ Kein Fragezeichen! Das Backend liefert IMMER mindestens []
  teamMembers: IUser[];     // ❌ Kein Fragezeichen!
}