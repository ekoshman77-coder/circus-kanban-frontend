import { UserModel } from "../../models/user-model";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";
import {
  AdminQueueAction,
  ApproveUserPayload,
  DeleteUserPayload
} from "../../models/queue-items/users-queue-payloads";

export class AdminStateProvider extends ArrayStateProvider< UserModel > {
  protected storageKey = 'offline_admin_all_users';

  // 🎯 Registriert UserModel für automatische Snapshot/Cache-Deserialisierung
  protected modelStatic = UserModel;

  constructor() {
    super([]);
  }

  // 🚀 Einzige Schnittstelle für State-Änderungen
  public override applyActionPayload(action: string, payload: any): void {
    switch (action as AdminQueueAction) {
      case 'SET_USERS': {
        const users = Array.isArray(payload)
          ? payload.map((u: any) => u instanceof UserModel ? u : UserModel.fromJson(u))
          : [];
        this.setRawState(users);
        break;
      }
      case 'APPROVE_USER': {
        const approvePayload = payload as ApproveUserPayload;
        this.applyAction((users) =>
          users.map((user) => {
            if (user.id === approvePayload.id) {
              // 🛡️ Klonen via cloneWith statt new UserModel({ ...user })
              return user.cloneWith({
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
}