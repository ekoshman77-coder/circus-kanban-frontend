import { Todo } from "../../models/todo";
import { ITodoJSON } from "../../repositories/dto/todo-json";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";

export class TodoStateProvider extends ArrayStateProvider<Todo> {
  protected storageKey = 'global_todos_pool';

  constructor() {
    super([]);
  }

  // 1. CACHE LADEN
  public override loadFromCache(): void {
    const cachedData = this.localStorageService.getItem<ITodoJSON[]>(this.storageKey);
    if (cachedData && Array.isArray(cachedData)) {
      const restored = cachedData.map((json) => Todo.fromJson(json));
      this.setRawState(restored);
    }
  }

  // 2. FORWARD REPLAY (Optimistic Updates für die Queue)
  public override applyActionPayload(action: string, payload: any): void {
    switch (action) {
      case 'SET_TODOS': {
        const todos = Array.isArray(payload?.todos)
          ? payload.todos.map((t: any) => (t instanceof Todo ? t : Todo.fromJson(t)))
          : [];
        this.setRawState(todos);
        break;
      }
      case 'CREATE': {
        if (payload?.todo) {
          const newTodo = payload.todo instanceof Todo ? payload.todo : Todo.fromJson(payload.todo);
          this.addOrUpdateItem(newTodo);
        }
        break;
      }
      case 'UPDATE': {
        if (payload?.todo) {
          const updatedTodo = payload.todo instanceof Todo ? payload.todo : Todo.fromJson(payload.todo);
          this.addOrUpdateItem(updatedTodo);
        }
        break;
      }
      case 'DELETE': {
        if (payload?.id) {
          this.removeItemById(payload.id);
        }
        break;
      }
      case 'BULK_DELETE_COMPLETED': {
        this.applyAction((items) => items.filter((t) => !(t.done && !t.milestoneId)));
        break;
      }
      case 'BULK_DELETE_ALL': {
        this.applyAction((items) => items.filter((t) => t.milestoneId));
        break;
      }
    }
  }

  // 3. RESTORE FROM SNAPSHOT
  public override restoreFromSnapshot(snapshot: unknown): void {
    if (Array.isArray(snapshot)) {
      const restored = (snapshot as ITodoJSON[]).map((json) => Todo.fromJson(json));
      this.setRawState(restored);
    }
  }
}