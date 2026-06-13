import { Component, inject, computed } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; // Pfad aus deiner TodoListComponent!
import { 
  DragDropModule, 
  CdkDragDrop, 
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { StatisticComponent } from '../statistic-component/statistic-component';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';

@Component({
  selector: 'app-todo-kanban',
  standalone: true,
  // 2. FÜGE DIE COMPONENT UND NGCLASS HIER IM ARRAY HINZU
  imports: [
    CommonModule,
    NgClass,
    TodoItemComponent, // <-- Das lässt das Kanban-Board die neue Komponente verstehen
    DragDropModule,
    StatisticComponent
  ],
  templateUrl: './todo-kanban-component.html',
  styleUrl: './todo-kanban-component.css'
})
export class TodoKanbanComponent {
  private todoService = inject(TodoService);

  // Wir greifen auf die gefilterten oder rohen Todos deines Services zu
  // Falls dein Service eine andere Methode für alle Todos hat (z.B. todosSignal), passe es kurz an
todoList = computed(() => 
    this.todoService.allTodos()
      .filter(t => !t.done)
      .map(todo => new TodoViewModel(todo, false))
  );

  doneList = computed(() => 
    this.todoService.allTodos()
      .filter(t => t.done)
      .map(todo => new TodoViewModel(todo, false))
  );
  
onDrop(event: CdkDragDrop<TodoViewModel[]>) { // Typisierung verfeinert
    if (event.previousContainer === event.container) {
      // Innerhalb der gleichen Spalte umsortieren
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Prüfen, in welche Spalte verschoben wurde anhand der Container-ID aus dem HTML
      const isMovingToDone = event.container.id === 'done-list';

      if (isMovingToDone) {
        // 1. Wir holen uns das verschobene ViewModel aus dem vorherigen Container,
        // BEVOR transferArrayItem das Array verändert!
        const movedViewModel = event.previousContainer.data[event.previousIndex];

        // 2. 🌟 DER MAGISCHE MOMENT: Wir triggern das ViewModel!
        // Das setzt 'showEffortPopup' auf true und bereitet das 'pendingTodo' vor.
        movedViewModel.onTodoChecked(this.todoService);

        // INFO: transferArrayItem rufen wir hier NICHT auf, wenn das Popup aufmacht.
        // Warum? Weil das Todo logisch erst in die "Fertig"-Spalte wandern soll,
        // wenn der User im Popup auf "OK" klickt! Das ViewModel regelt das dann automatisch.
        
      } else {
        // Falls ein To-Do von "Fertig" zurück nach "To Do" gezogen wird (Ent-haken):
        const movedViewModel = event.previousContainer.data[event.previousIndex];
        
        // Das CDK verschiebt es visuell sofort zurück
        transferArrayItem(
          event.previousContainer.data,
          event.container.data,
          event.previousIndex,
          event.currentIndex
        );
        
        // Und das ViewModel schickt den Rückgängig-Befehl an den Service
        movedViewModel.onTodoChecked(this.todoService);
      }
    }
  }
  
  get stats() {
    return this.todoService.statistics();
  }
}