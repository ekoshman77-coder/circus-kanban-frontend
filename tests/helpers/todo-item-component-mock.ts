import { Component, input, output, Input } from '@angular/core';

@Component({
  selector: 'app-todo-item',
  template: '<div class="mock-todo-item">Mock Todo Item</div>',
  standalone: true
})
export class TodoItemComponentMock {
  // Signal-Inputs & klassische Inputs der echten Komponente
  item = input<any>();
  @Input() isDescriptionOpen: boolean = false;
  @Input() isKanbanMode: boolean = true;
  isTeamsPopupEnabled = input<boolean>(false);
  assignableUsers = input<any[]>([]);

  // Outputs
  toggleDescription = output<void>();
  toggleComplete = output<void>();
  delete = output<void>();
  reviewTriggered = output<any>();
}