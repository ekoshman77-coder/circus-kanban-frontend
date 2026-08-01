import { Component, inject, computed, OnInit } from '@angular/core';
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
import { FilterService } from '../../../core/services/filter/filter-service';
import { Todo } from '../../../core/models/todo';
import { BaseTodoBoardComponent } from '../base-todo-board-component';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';

@Component({
  selector: 'app-todo-kanban',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    TodoItemComponent, 
    DragDropModule,
    StatisticComponent,
    TodoFooterComponent,
    UniversalPopupComponent
  ],
  templateUrl: './todo-kanban-component.html',
  styleUrl: './todo-kanban-component.css'
})
export class TodoKanbanComponent extends BaseTodoBoardComponent implements OnInit {
  
  private filterService = inject(FilterService)

  ngOnInit(): void {
    this.filterService.setInitialCategory('todos');
  }

  // 1. Die privaten Todos direkt aus dem Service
  public privateTodos = computed(() => {
    return this.todoService.privateTodos();
  });

public filteredPrivateTodos = computed(() => {
    const rawTodos = this.todoService.privateTodos();
    const term = this.filterService.searchTerm().toLowerCase().trim();
    const category = this.filterService.currentCategory();

    // Wenn kein Suchbegriff da ist, gib alles ungefiltert weiter
    if (!term) {
      return rawTodos;
    }

    // Das Board reagiert, wenn 'Alles' oder 'To-Dos' im Header ausgewählt ist
    if (category !== 'all' && category !== 'todos') {
      return rawTodos;
    }

    // Nutzt dieselbe saubere Filter-Logik wie die Liste
    return rawTodos.filter(todo => this.todoTermFilter(todo, term));
  });

  private todoTermFilter(todo: Todo, term: string): boolean {
    return todo.task.toLowerCase().includes(term)
           || (todo.description ?? "").toLowerCase().includes(term)
           || (todo.category ?? "").toLowerCase().includes(term);
  }

  // 3. Reaktiv die gefilterten Todos in ViewModels umwandeln
  public kanbanViewModels = computed(() => {
    return this.filteredPrivateTodos().map(todo => { // 💡 Nutzt jetzt filteredPrivateTodos
      return new TodoViewModel(todo, false, true, true);
    });
  });

  // 4. Die Spalten greifen wie gewohnt reaktiv zu (bleibt unverändert!)
  public todoList = computed(() => {
    return this.kanbanViewModels().filter(vm => !vm.todo.done);
  });

  public doneList = computed(() => {
    return this.kanbanViewModels().filter(vm => vm.todo.done);
  });

  // 5. Statistik-Todos: Auch hier filtern wir die Rohdaten für korrekte Zähler!
  protected todosForStats = computed(() => {
    return this.filteredPrivateTodos();
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