import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { TodoService, Filter } from '../../../core/services/todo/todo-service';
//import { PercentFormatPipe } from '../../../shared/pipes/percent-format/percent-format-pipe';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { FilterComponent } from '../filter-component/filter-component';
import { StatisticComponent } from '../statistic-component/statistic-component';
import { trigger, transition, style, animate } from '@angular/animations';
import confetti from 'canvas-confetti';
import { FILTER_ANIMATION, TO_DO_ANIMATION } from './todo-list-animation';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';

export enum VisualStatus {
  ON_TIME = "on-time",
  COMPLETED = "completed",
  OVERDUE = "overdue",
  PENDING = "pending",
  DUE_TODAY = "due-today"
}

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    TodoItemComponent,
    FilterComponent,
    StatisticComponent
  ],
  templateUrl: './todo-list-component.html',
  styleUrl: './todo-list-component.css',
  animations: [
    TO_DO_ANIMATION,
    FILTER_ANIMATION

  ] // <-- Ende des animations-Arrays
})
export class TodoListComponent {
  private todoService = inject(TodoService);
  public openedDescrIds = signal<Set<string>>(new Set());

  public uiTodos = computed<TodoViewModel[]>(() => {
    const rawTodos = this.todoService.filteredTodos();
    const openIds = this.openedDescrIds();

    // Wunderbar schlank, typsicher und rein objektorientiert!
    return rawTodos.map(todo => new TodoViewModel(todo, openIds.has(todo.id)));
  });

  private filterLabels: Record<Filter, string> = {
    [Filter.ALL]: 'Alle 📋',
    [Filter.OPEN]: 'Offen 📖',
    [Filter.COMPLETED]: 'Erledigt ✅',
    [Filter.DUE_TODAY]: 'Heute fällig ⏳', // 🔥 Jetzt perfekt mit der Sanduhr!
    [Filter.OVERDUE]: 'Überfällig 🚨'      // Das Alarm-Blaulicht bleibt!
  };

  public FilterEnum = Filter;
  public availableFilters = Object.values(Filter).map(enumValue => ({
    value: enumValue,
    label: this.filterLabels[enumValue] // Holt sich das schöne Label aus dem Mapping oben
  }));

  get stats() {
    return this.todoService.statistics();
  }

  get currentFilter(): Filter {
    return this.todoService.filterSignal();
  }

  onFilterChange(newFilter: Filter): void {
    this.todoService.filterSignal.set(newFilter);
  }

  public percent = computed(() => {
    const statistic = this.todoService.statistics()
    if (statistic.total === 0) return 0;
    return statistic.completed / statistic.total * 100
  })

  // 🔥 NEU: Schlaue Nachrichten für leere Filter-Zustände!
  public emptyFilterMessage = computed(() => {
    const filter = this.currentFilter;
    const todosCount = this.uiTodos().length;

    if (todosCount > 0) return null; // Wenn Aufgaben da sind, brauchen wir keine Nachricht!

    switch (filter) {
      case this.FilterEnum.COMPLETED:
        return {
          icon: '💨',
          title: 'Noch nichts geschafft?',
          text: 'Hier landen deine erledigten Aufgaben. Packen wir es an!'
        };
      case this.FilterEnum.DUE_TODAY:
        return {
          icon: '☕',
          title: 'Durchatmen angesagt!',
          text: 'Für heute stehen keine Aufgaben mehr auf dem Zettel. Zeit für Kaffee!'
        };
      case this.FilterEnum.OVERDUE:
        return {
          icon: '🎉',
          title: 'Absolut im Zeitplan!',
          text: 'Keine einzige Aufgabe ist überfällig. Du hast die Zeitmaschine im Griff!'
        };
      case this.FilterEnum.OPEN:
        return {
          icon: '🕊️',
          title: 'Himmlische Ruhe...',
          text: 'Du hast aktuell keine offenen Aufgaben. Genieße die Freizeit!'
        };
      default: // Filter.ALL
        return {
          icon: '📝',
          title: 'Deine Liste ist leer',
          text: 'Erstelle oben deine erste Aufgabe, um produktiv zu werden!'
        };
    }
  });

  // // --- HIER RECHNEN WIR JETZT EXAKT DEINE LOGIK AUS ---
  // public uiTodos = computed(() => {
  //   const rawTodos = this.todoService.filteredTodos(); 
  //   const now = Date.now();
  //   const openIds = this.openedDescrIds();

  //   return rawTodos.map(todo => {
  //     // 1. VisualStatus (deine CSS-Klasse wird später 'status-' + visualStatus)
  //     let visualStatus = todo.getVisualStatus();

  //     // 2. Datumstext ermitteln (Fällig vs Erledigt)
  //     const timestamp = (todo.done && todo.completedAt !== null) ? todo.completedAt : todo.dueDate;
  //     const label = todo.done ? 'Erledigt ' : 'Fällig ';

  //     return {
  //       id: todo.id,
  //       task: todo.task,
  //       description: todo.description,
  //       effort: todo.effort,
  //       done: todo.done,
  //       visualStatus: visualStatus,
  //       dateText: label,
  //       timestamp: timestamp,
  //       // Ist diese Beschreibung gerade offen? (Prüfung gegen unser Set)
  //       descriptionOpen: openIds.has(todo.id),
  //       category: todo.category
  //     };
  //   });
  // });

  // Umschalten der Beschreibung (Auf/Zu)
  toggleDescription(id: string): void {
    const currentSet = new Set(this.openedDescrIds());
    if (currentSet.has(id)) {
      currentSet.delete(id);
    } else {
      currentSet.add(id);
    }
    this.openedDescrIds.set(currentSet); // Signal aktualisieren, UI zeichnet sich neu
  }

  onToggleComplete(id: string): void {
    const todo = this.uiTodos().find(t => t.id === id);

    // 2. Wenn es existiert und AKTUELL noch OFFEN ist (also jetzt erledigt wird!)
    if (todo && !todo.done) {
      // 🎆 FEUERWERK!
      confetti({
        particleCount: 150, // Wie viele Konfetti-Schnipsel
        spread: 80,         // Wie weit sie streuen
        origin: { y: 0.6 }  // Startet leicht im unteren Drittel des Bildschirms
      });
    }
  }

  onDeleteTodo(id: string): void {
    this.todoService.deleteTodo(id);
  }
}