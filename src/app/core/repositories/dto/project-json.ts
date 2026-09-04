import { IMilestoneJSON } from "./milestone-json";
import { IProjectMemberJSON } from "./project-member-json";

export interface IProjectJSON {
  id: string;
  ideaId: string;
  userId: string;
  title: string;
  area: string;
  content?: string;
  status: 'Calculation' | 'Active' | 'Zip';
  departmentId: string;
  scope: string;
  milestones: IMilestoneJSON[];     // Aus Kotlin milestones
  teamMembers: IProjectMemberJSON[]; // ✨ Sauber typisiert mit Rollen!
}