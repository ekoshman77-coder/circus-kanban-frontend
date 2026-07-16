import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { TodoService, Filter } from '../../../core/services/todo/todo-service';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { FilterComponent } from '../filter-component/filter-component';
import { StatisticComponent, calculateTodoStats } from '../statistic-component/statistic-component'; // 💡 Utility geladen!
import { trigger, transition, style, animate } from '@angular/animations';
import confetti from 'canvas-confetti';
import { FILTER_ANIMATION, TO_DO_ANIMATION } from './todo-list-animation';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { TodoQueryService } from '../../../core/services/todo/todo-query-service'; // 💡 Unser Kreis-Sprenger!
import { VisualStatus } from '../../../core/models/todo';
import { TodoFooterComponent } from '../todo-footer-component/todo-footer-component';

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
export class TodoListComponent {
  private todoService = inject(TodoService);
  private todoQueryService = inject(TodoQueryService); // Injizieren für Rechte-Prüfung!

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

  // 🌍 DIE REAKTIVE BRÜCKE: Mapped Todos zu ViewModels samt Permissions!
  uiTodos = computed(() => {
    const rawTodos = this.todoService.filteredFocusedTodos();
    const now = Date.now();
    const todayEnd = new Date().setHours(23, 59, 59, 999);
    const openIds = this.openedDescrIds(); // 💡 Holt das reaktive Set der geöffneten IDs

    return rawTodos.map(todo => {
      let status = VisualStatus.ON_TIME;
      if (todo.done) {
        status = VisualStatus.COMPLETED;
      } else if (todo.dueDate < now) {
        status = VisualStatus.OVERDUE;
      } else if (todo.dueDate <= todayEnd) {
        status = VisualStatus.DUE_TODAY;
      }

      // 💡 1. Prüfen, ob die ID dieses Todos im Set der geöffneten Beschreibungen existiert
      const isDescriptionOpen = openIds.has(todo.id);
      
      const canEdit = this.todoQueryService.hasPermissionForMilestone(todo.milestoneId, 'TODO_EDIT');
      const canDelete = this.todoQueryService.hasPermissionForMilestone(todo.milestoneId, 'TODO_DELETE');

      // 💡 2. Die Argumente exakt in der Reihenfolge des Konstruktors übergeben!
      return new TodoViewModel(
        todo,
        isDescriptionOpen, // <-- Als 2. Argument (wichtig!)
        canEdit,
        canDelete
      );
    });
  });

  protected todosForStats = computed(() => {
    return this.uiTodos().map(vm => vm.todo);
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
    this.todoService.deleteTodo(id);
  }

  onClearCompleted(): void {
    const completedTodos = this.uiTodos().filter(todoViewModel => todoViewModel.done);
    const allowed = completedTodos.filter(todoViewModel =>
      this.todoQueryService.hasPermissionForMilestone(todoViewModel.todo.milestoneId, 'TODO_DELETE')
    );

    allowed.forEach(todoViewModel => {
      this.todoService.deleteTodo(todoViewModel.id);
    });
  }

  toggleDescription(id: string): void {
    const currentSet = new Set(this.openedDescrIds());
    if (currentSet.has(id)) {
      currentSet.delete(id);
    } else {
      currentSet.add(id);
    }
    this.openedDescrIds.set(currentSet);
  }

  onToggleComplete(id: string): void {
    const todo = this.uiTodos().find(t => t.id === id);
    if (todo && !todo.done) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
    this.todoService.toggleComplete(id, 0);
  }
}