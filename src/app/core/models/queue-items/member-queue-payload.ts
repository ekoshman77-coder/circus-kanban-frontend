
import { SnapshotPayload } from "./queue-item";
import { IUser } from "../../repositories/user-repository";

// 1. Basis für alle Member-Payloads mit IUserJSON-Snapshot
export interface MemberSnapshotPayload extends SnapshotPayload< IUser> {}

// 2. Member Löschen (id kommt aus SnapshotPayload)
export interface DeleteMemberPayload extends MemberSnapshotPayload {}

// 3. Member Erstellen
export interface CreateMemberPayload extends MemberSnapshotPayload {
  username: string;
  firstName: string;
  lastName: string;
  password?: string;
}

// 4. Kaffeekasse / Coffee Balance Update
export interface CoffeePayload extends MemberSnapshotPayload {
  balance: number;
  role: string;
  emoji: string;
}

// 5. Profil Update
export interface ProfilePayload extends MemberSnapshotPayload {
  username: string;
  firstName: string;
  lastName: string;
}