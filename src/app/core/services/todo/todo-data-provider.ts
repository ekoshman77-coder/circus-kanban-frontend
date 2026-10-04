import { Todo } from "../../models/todo";
import { ArrayStateProvider } from "../central-queue/state-providers/array-state-provider";

export class TodoStateProvider extends ArrayStateProvider<Todo> {
  protected override storageKey = 'global_todos_pool';

  // 🎯 Statische Modell-Referenz für generisches Deserialisieren & Cache-Laden
  protected modelStatic = Todo;

  constructor() {
    super([]);
  }

  // 🚀 FORWARD REPLAY (Optimistic Updates für die Queue)
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
}