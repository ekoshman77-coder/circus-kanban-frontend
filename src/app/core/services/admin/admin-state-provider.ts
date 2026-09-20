import { UserModel } from "../../models/user-model";
import { IUser } from "../../repositories/dto/user-dto";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";
import {
  AdminQueueAction,
  ApproveUserPayload,
  DeleteUserPayload
} from "../../models/queue-items/users-queue-payloads";

export class AdminStateProvider extends ArrayStateProvider<UserModel> {
  protected storageKey = 'offline_admin_all_users';

  constructor() {
    super([]);
  }

  public loadFromCache(): void {
    const cached = this.localStorageService.getItem(this.storageKey);
    if (cached && Array.isArray(cached)) {
      const restored = (cached as IUser[]).map((json) => UserModel.fromJson(json));
      this.setRawState(restored);
    }
  }

  // 🚀 Einzige Schnittstelle für State-Änderungen
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as AdminQueueAction) {
      case 'SET_USERS': {
        const users = payload as UserModel[];
        this.setRawState(users);
        break;
      }
      case 'APPROVE_USER': {
        const approvePayload = payload as ApproveUserPayload;
        this.applyAction((users) =>
          users.map((user) => {
            if (user.id === approvePayload.id) {
              return new UserModel({
                ...user,
                isApproved: true,
                departmentRole: approvePayload.role,
                department: { id: approvePayload.departmentId } as any
              });
            }
            return user;
          })
        );
        break;
      }
      case 'DELETE_USER': {
        const deletePayload = payload as DeleteUserPayload;
        this.removeItemById(deletePayload.id);
        break;
      }
    }
  }

  public override restoreFromSnapshot(snapshot: unknown): void {
    if (Array.isArray(snapshot)) {
      const restored = (snapshot as IUser[]).map((json) => UserModel.fromJson(json));
      this.setRawState(restored);
    }
  }
}