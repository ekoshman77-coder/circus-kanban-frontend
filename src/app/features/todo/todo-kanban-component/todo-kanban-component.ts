import { Component, inject, computed } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { 
  DragDropModule, 
  CdkDragDrop, 
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { StatisticComponent } from '../statistic-component/statistic-component';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model'; // 🌟 ViewModel importiert!
import { TodoFooterComponent } from '../todo-footer-component/todo-footer-component';

@Component({
  selector: 'app-todo-kanban',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    TodoItemComponent, 
    DragDropModule,
    StatisticComponent,
    TodoFooterComponent
  ],
  templateUrl: './todo-kanban-component.html',
  styleUrl: './todo-kanban-component.css'
})
export class TodoKanbanComponent {
  private todoService = inject(TodoService);

  // 1. Die privaten Todos direkt aus dem Service
  public privateTodos = computed(() => {
    return this.todoService.privateTodos();
  });

  // 2. 🌟 DIE RETTUNG: Wir verpacken jedes private Todo in ein ViewModel!
  // Da es private Todos sind, darf der User sie immer bearbeiten und löschen (true, true)
  public kanbanViewModels = computed(() => {
    return this.privateTodos().map(todo => {
      return new TodoViewModel(todo, false, true, true);
    });
  });

  // 3. Deine Spalten filtern jetzt reaktiv aus den ViewModels:
  public todoList = computed(() => {
    return this.kanbanViewModels().filter(vm => !vm.todo.done);
  });

  public doneList = computed(() => {
    return this.kanbanViewModels().filter(vm => vm.todo.done);
  });

  // Drag & Drop Methode arbeitet nun sicher mit TodoViewModel[]
  public onDrop(event: CdkDragDrop<TodoViewModel[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const isMovingToDone = event.container.id === 'done-list';

      if (isMovingToDone) {
        // Hier greifen wir sicher auf das echte ViewModel zu!
        const movedViewModel = event.previousContainer.data[event.previousIndex];
        movedViewModel.onTodoChecked(this.todoService);
      } else {
        const movedViewModel = event.previousContainer.data[event.previousIndex];
        transferArrayItem(
          event.previousContainer.data,
          event.container.data,
          event.previousIndex,
          event.currentIndex
        );
        movedViewModel.onTodoChecked(this.todoService);
      }
    }
  }
}