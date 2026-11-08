import { Component, input, signal, computed, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerService, RecommendedTodoItem } from '../../../core/services/ai/planner-service';
import { AcceptAction, RejectAction } from '../../../core/models/recommendation-actions';
import { RecommendationCardComponent } from '../recommendation-card-component/recommendation-card-component';

@Component({
  selector: 'app-planner-recommendation',
      standalone: true,
  imports: [CommonModule, RecommendationCardComponent],
  templateUrl: './planner-recommendation-component.html',
  styleUrls: ['./planner-recommendation-component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlannerRecommendationComponent {
  private plannerService = inject(PlannerService);

  recommendations = input<RecommendedTodoItem[]>([]);
  roundId = input<string>("");

  // 🎯 Das hat dem Compiler gefehlt:
  sessionCompleted = output<string | null>();

  private rejectionsBuffer = signal<string[]>([]);

  visibleList = computed(() => {
    const rejectedIds = this.rejectionsBuffer();
    return this.recommendations().filter(item => !rejectedIds.includes(item.todo.id));
  });

  onCardAccepted(action: AcceptAction) {
    this.plannerService.acceptRecommendation(action);
    
    // Signalisiere der Seite, dass eine Aktion erfolgt ist (schließt das Panel)
    this.sessionCompleted.emit( action.todoId );
  }

  onCardRejected(action: RejectAction) {
    this.rejectionsBuffer.update(list => [...list, action.todoId]);
    this.plannerService.rejectRecommendation(action);

  if (this.visibleList().length === 0) {
      this.sessionCompleted.emit(null);
    }
  }
}