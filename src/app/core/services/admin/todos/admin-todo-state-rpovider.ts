import { TodoAction } from "../../../models/queue-items/todo-queue-payload";
import { Todo } from "../../../models/todo";
import { TodoStateProvider } from "../../todo/todo-data-provider";

export class AdminTodoStateProvider extends TodoStateProvider {
  // 🛡️ Eigener Storage-Key für den Admin-Todo-Cache!
  protected override storageKey = 'local_admin_todos_global_pool';

    // 🚀 FORWARD REPLAY (Optimistic Updates für die Queue)
    public override applyActionPayload(action: string, payload: any): void {
      const todoAction = action as TodoAction
      switch (todoAction) {
        case 'UPDATE':
        case 'RESTORE':
        case 'SANITIZE_FEEDBACK':    
        case 'DELETE': {
           break;
        }
        default: {
          super.applyActionPayload(action, payload);
          break;
        }
      }
    }  
}