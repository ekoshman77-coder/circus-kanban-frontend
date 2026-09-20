import { SnapshotPayload } from "./queue-item";
import { IProjectJSON } from "../../repositories/dto/project-json";
import { Project } from "../project";
import { ProjectRole } from "../user-model";
import { TodoSnapshotPayload } from "./todo-queue-payload";
import { Identifiable } from "../identifable";

export type ProjectAction =
  | 'SET_PROJECTS'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ADD_MEMBER'
  | 'REMOVE_MEMBER'
  | 'TRACK_SELECTION'
  | 'TRACK_DEGRADATION'
  | 'TRACK_IGNORANCE';

// 1. Gemeinsame Basis für alle Projekt-Payloads mit IProjectJSON-Snapshot
export interface ProjectSnapshotPayload extends SnapshotPayload< IProjectJSON> {}

// 2. CREATE & UPDATE: Vollständiges Project-Objekt (oder IProjectJSON)
export interface ProjectPayload extends ProjectSnapshotPayload {
  project: Project;
}

// 3. DELETE: Braucht nur die ID (id kommt aus ProjectSnapshotPayload)
export interface DeleteProjectPayload extends ProjectSnapshotPayload {}

// 4. MEMBER HINZUFÜGEN
export interface AddMemberPayload extends ProjectSnapshotPayload {
  userId: string;
  role: ProjectRole;
}

// 5. MEMBER ENTFERNEN
export interface RemoveMemberPayload extends ProjectSnapshotPayload {
  userId: string;
}

// 6. TRACKING: Einzelner ausgewählter / herabgestufter Meilenstein
export interface TrackMilestonePayload extends Identifiable {
  projectTitle: string;
  projectArea: string;
  milestoneTitle: string;
  userId: string;
}

// 7. TRACKING: Ignorierte Meilensteine (Bulk-Kette)
export interface TrackMilestoneIgnorancePayload extends Identifiable {
  projectTitle: string;
  projectArea: string;
  milestoneTitles: string[];
  userId: string;
}