import { Component, computed, inject, input, output } from '@angular/core';
import { TodoService } from '../../../core/services/todo/todo-service';
import { ConnectionService } from '../../../core/services/connection/connection-service';
import { Todo } from '../../../core/models/todo';

@Component({
  selector: 'app-todo-footer',
  standalone: true,
  imports: [], // <-- Kein UniversalPopupComponent mehr nötig!
  templateUrl: './todo-footer-component.html',
  styleUrl: './todo-footer-component.css'
})
export class TodoFooterComponent {
  protected connectionService = inject(ConnectionService);

  public currentTodos = input.required<Todo[]>();
  
  // ⚡ Die neuen Event-Kanäle nach oben zur Liste!
  public requestClearCompleted = output<void>();
  public requestClearAll = output<void>();

  public totalOpenEffort = computed(() => {
    const openTodos = this.currentTodos().filter(t => !t.done);
    return openTodos.reduce((prev, t) => prev + (t.effort || 0), 0);
  });

  public isListEmpty = computed(() => {
    return this.currentTodos().length === 0;
  });

  public disableDeleteButtons = computed(() => {
     return this.connectionService.status() === "OFFLINE";
  });
}