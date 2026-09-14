import { SnapshotPayload } from "./queue-item";
import { IProjectJSON } from "../../repositories/dto/project-json";
import { Project } from "../project";
import { ProjectRole } from "../user-model";

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