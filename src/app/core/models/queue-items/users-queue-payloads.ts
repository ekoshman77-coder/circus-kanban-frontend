import { IUser } from "../../repositories/user-repository";
import { SnapshotPayload } from "./queue-item";

// 1. Basis für alle User-Payloads mit IUserJSON-Snapshot
export interface UserSnapshotPayload extends SnapshotPayload< IUser> {}

// 2. CREATE & UPDATE: Vollständiges User-Objekt
export interface UserPayload extends UserSnapshotPayload {
  user: IUser;
}

// 3. DELETE: Braucht nur die ID (id kommt aus UserSnapshotPayload)
export interface DeleteUserPayload extends UserSnapshotPayload {}

// 4. APPROVE: Freigabe von neuen Accounts im Department
export interface ApproveUserPayload extends UserSnapshotPayload {
  departmentId: string;
  role: string;
}