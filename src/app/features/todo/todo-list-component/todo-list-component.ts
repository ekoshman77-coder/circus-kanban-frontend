import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { TodoService, Filter } from '../../../core/services/todo/todo-service';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { FilterComponent } from '../filter-component/filter-component';
import { StatisticComponent } from '../statistic-component/statistic-component'; // 💡 Utility geladen!
import confetti from 'canvas-confetti';
import { FILTER_ANIMATION } from './todo-list-animation';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { TodoQueryService } from '../../../core/services/todo/todo-query-service'; // 💡 Unser Kreis-Sprenger!
import { Todo, VisualStatus } from '../../../core/models/todo';
import { TodoFooterComponent } from '../todo-footer-component/todo-footer-component';
import { FilterService } from '../../../core/services/filter/filter-service';

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    TodoItemComponent,
    FilterComponent,
    StatisticComponent,
    TodoFooterComponent
  ],
  templateUrl: './todo-list-component.html',
  styleUrl: './todo-list-component.css',
  animations: [FILTER_ANIMATION]
})
export class TodoListComponent implements OnInit {
  private todoService = inject(TodoService);
  private todoQueryService = inject(TodoQueryService);
  private filterService = inject(FilterService)

  // Zustand für aufgeklappte Beschreibungen
  openedDescrIds = signal<Set<string>>(new Set());

  // Die verfügbaren Filter für die UI
  availableFilters = [
    { value: Filter.ALL, label: 'Alle Aufgaben 📋' },
    { value: Filter.OPEN, label: 'Offen ⏳' },
    { value: Filter.COMPLETED, label: 'Erledigt ✅' },
    { value: Filter.DUE_TODAY, label: 'Heute fällig 📅' },
    { value: Filter.OVERDUE, label: 'Überfällig 🚨' }
  ];

  // Liefert den aktuell aktiven Filter aus dem Service
  get currentFilter(): Filter {
    return this.todoService.filterSignal();
  }

  ngOnInit(): void {
    this.filterService.setInitialCategory("todos")
  }

  filteredTodos = computed(() => {
    const rawTodos = this.todoService.filteredFocusedTodos();
    const term = this.filterService.searchTerm().toLowerCase().trim();

    if (!term) {
      return rawTodos;
    }

    const category = this.filterService.currentCategory();
    if (category !== 'all' && category !== 'todos') {
      return rawTodos;
    }

    return rawTodos.filter(todo => this.todoTermFilter(todo, term));
  });

  private todoTermFilter(todo: Todo, term: string): boolean {
    return todo.task.toLowerCase().includes(term)
      || (todo.description ?? "").toLowerCase().includes(term)
      || (todo.category ?? "").toLowerCase().includes(term);
  }

  // 🌍 DIE REAKTIVE BRÜCKE: Mapped Todos zu ViewModels samt Permissions!
  uiTodos = computed(() => {
    const rawTodos = this.filteredTodos();
    const openIds = this.openedDescrIds(); // 🛡️ Reaktive Spur gesichert!

    return rawTodos.map(todo => this.mapToViewModel(todo, openIds));
  });

  private mapToViewModel(todo: Todo, openIds: Set<string>): TodoViewModel {
    return new TodoViewModel(
      todo,
      openIds.has(todo.id),
      this.todoQueryService.hasPermissionForMilestone(todo.milestoneId, 'TODO_EDIT'),
      this.todoQueryService.hasPermissionForMilestone(todo.milestoneId, 'TODO_DELETE')
    );
  }

  protected todosForStats = computed(() => {
    return this.filteredTodos();
  });

  // Nachricht für leere Filter-Zustände
  emptyFilterMessage = computed(() => {
    const filter = this.todoService.filterSignal();
    switch (filter) {
      case Filter.OPEN:
        return { icon: '🎉', title: 'Alles erledigt!', text: 'Du hast aktuell keine offenen Aufgaben.' };
      case Filter.COMPLETED:
        return { icon: '✨', title: 'Noch nichts geschafft?', text: 'Erledige eine Aufgabe, um sie hier zu sehen.' };
      case Filter.DUE_TODAY:
        return { icon: '☕', title: 'Entspannter Tag!', text: 'Heute stehen keine fälligen Aufgaben an.' };
      case Filter.OVERDUE:
        return { icon: '🍀', title: 'Alles im grünen Bereich!', text: 'Du hast keine überfälligen Aufgaben.' };
      default:
        return { icon: '📝', title: 'Deine Liste ist leer', text: 'Füge eine neue Aufgabe hinzu, um zu starten!' };
    }
  });

  onFilterChange(newFilter: Filter): void {
    this.todoService.filterSignal.set(newFilter);
  }

  onDeleteTodo(id: string): void {
    console.log("TodoList: onDeleteTodo startet");

  // 1. Finde das echte To-Do-Objekt aus dem Stream
  const todo = this.filteredTodos().find(t => t.id === id);
  
  if (todo) {
    // 2. HIER MUSS UNSERE NEUE UNDO-METHODE REIN!
    this.todoService.deleteTodoWithUndo(todo);
  } else {
    // Nur zur Sicherheit, falls es im ViewModel-Mapping verschluckt wurde:
    console.warn("Todo nicht im gefilterten Stream gefunden!");
  }
}

//   onClearCompleted(): void {
//     const completedTodos = this.uiTodos().filter(todoViewModel => todoViewModel.done);
//     const allowed = completedTodos.filter(todoViewModel =>
//       this.todoQueryService.hasPermissionForMilestone(todoViewModel.todo.milestoneId, 'TODO_DELETE')
//     );

//     allowed.forEach(todoViewModel => {
// //      this.todoService.deleteTodo(todoViewModel.id);
//     });
//   }

  toggleDescription(id: string): void {
    const currentSet = new Set(this.openedDescrIds());
    if (currentSet.has(id)) {
      currentSet.delete(id);
    } else {
      currentSet.add(id);
    }
    this.openedDescrIds.set(currentSet);
  }
}