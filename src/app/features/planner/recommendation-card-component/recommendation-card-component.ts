import { Component, computed, HostBinding, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { AcceptAction, AcceptReason, RejectAction, RejectReason } from '../../../core/models/recommendation-actions';
import { RecommendedTodoItem } from '../../../core/models/recommendation-view-models';

@Component({
  selector: 'app-recommendation-card',
  standalone: true,
  imports: [CommonModule, TodoItemComponent],
  templateUrl: './recommendation-card-component.html',
  styleUrl: './recommendation-card-component.css'
})
export class RecommendationCardComponent {
  // Moderne Angular Signals für Inputs & Outputs
  item = input.required<RecommendedTodoItem>();
  roundId = input.required<string>()
  acceptText = input<string>('🚀 Anpacken');
  
  accepted = output<AcceptAction>();
  rejected = output<RejectAction>();

  activePopoverId = signal<boolean>(false);

  // ViewModel für die Todo-Komponente aufbereiten
  todoViewModel = computed(() => new TodoViewModel(this.item().todo, false)); // fix computed or direct getter

  get formattedTodoVm() {
    return new TodoViewModel(this.item().todo, false);
  }

  onSelect(reason?: AcceptReason) {
    this.accepted.emit({
      roundId: this.roundId(),
      todoId: this.item().todo.id,
      reason
    });
  }

  onReject(reason: RejectReason) {
    this.rejected.emit({
      roundId: this.roundId(), 
      todoId: this.item().todo.id, 
      reason 
    });
  }
}