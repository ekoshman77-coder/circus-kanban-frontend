import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Filter } from '../../../core/services/todo/todo-service';

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-component.html',
  styleUrl: './filter-component.css'
})
export class FilterComponent {
  @Input() currentFilter: Filter = Filter.ALL;

  // 🔥 NEU: Wir empfangen die fertig generierten Filter samt Icons aus der TodoList
  @Input() availableFilters: { value: Filter, label: string }[] = [];

  @Output() filterChanged = new EventEmitter<Filter>();

  onFilterChange(filterValue: Filter): void {
    this.filterChanged.emit(filterValue);
  }

  // Hilfsmethode fürs HTML, um Text und Icon für das Tooltip sauber zu trennen
  getIconAndText(label: string) {
    const parts = label.split(' ');
    const icon = parts.pop() || ''; // Das Emoji am Ende extrahieren
    const text = parts.join(' ');   // Der reine Text davor
    return { icon, text };
  }
}