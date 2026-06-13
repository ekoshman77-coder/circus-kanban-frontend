import { Component, computed, inject } from '@angular/core';
import { TodoService } from '../../../core/services/todo/todo-service'; // Pfad anpassen
import { ConnectionService } from '../../../core/services/connection-service';

@Component({
  selector: 'app-todo-footer',
  standalone: true,
  imports: [], // <-- Komplett leer! Keine TodoListComponent nötig!
  templateUrl: './todo-footer-component.html',
  styleUrl: './todo-footer-component.css'
})

export class TodoFooterComponent {
  protected todoService = inject(TodoService);
  protected connectionService = inject(ConnectionService)

  public disableDeleteButtons = computed(() => {
     return this.connectionService.status() === "OFFLINE"
  })

  get totalOpenEffort(): number {
    return this.todoService.totalOpenEffort();
  }

  get isListEmpty(): boolean {
    return this.todoService.isListEmpty();
  }


  // Die von dir vorgeschlagenen Methoden in der Komponente
  onClearCompleted(): void {
    // Hier könnten wir später ein "Anleitung/Bestätigungs-Popup" einbauen
    this.todoService.clearCompletedTodos();
  }

  onClearAll(): void {
    // Hier könnte ein confirm() stehen:
    if (confirm('Möchten Sie wirklich alle Aufgaben unwiderruflich löschen?')) {
      this.todoService.clearAllTodos();
    }
  }
}