import { Component, inject } from '@angular/core';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { RecommendationResult } from '../../../core/models/recommendation-result';
import { PlannerRecommendationComponent } from '../../planner/planner-recommendation-component/planner-recommendation-component';
import { TodoService } from '../../../core/services/todo/todo-service';

@Component({
  selector: 'app-group-planner-modal',
  imports: [PlannerRecommendationComponent],
  templateUrl: './group-planner-component.html',
  styleUrl: './group-planner-component.css',
})
export class GroupPlannerModalComponent {
  public plannerService = inject(PlannerService);
  private todoService = inject(TodoService)

public handleSessionCompleted(result: RecommendationResult): void {
    // 2. Wenn ein Todo ausgewählt wurde, kannst du es als Fokus setzen (optional)
    if (result.selectedTodoId) {
      const realTodo = this.todoService.getTodoById(result.selectedTodoId);
      if (realTodo) {
        // z.B. als aktiven Fokus setzen, falls gewünscht
      }
    }

    // 🚀 3. HIER IST DER SCHLÜSSEL: Das Modal sofort reaktiv schließen!
    this.plannerService.closePlannerModal();
  }

  public closeModal(): void {
    this.plannerService.closePlannerModal();
  }
}