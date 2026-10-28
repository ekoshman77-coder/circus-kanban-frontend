import { Injectable, signal } from "@angular/core";

@Injectable({ 
  providedIn: 'root' 
})
export class TodoModalService {
  public activeEditingTodoId = signal<string | null>(null);

  public openEdit(id: string) {
    console.log('🚀 [TodoModalService] openEdit aufgerufen mit ID:', id);
    this.activeEditingTodoId.set(id);
  }

  public closeEdit() {
    console.log('🧹 [TodoModalService] closeEdit aufgerufen');
    this.activeEditingTodoId.set(null);
  }
}