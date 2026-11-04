import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { RecommendationResult, RejectReason } from '../../../core/models/recommendation-result';
import { PlannerService, RecommendedTodoItem } from '../../../core/services/ai/planner-service';
import { TodoItemComponent } from '../../../core/shared/components/todo-item-component/todo-item-component';
import { TodoViewModel } from '../../../core/viewmodel/todo-view-model';
import { PlannerRecommendationDetail } from '../../../core/repositories/ai-repository';
import { CommonModule } from '@angular/common';

export type AcceptReason = 'select_easy' | 'select_ontime' | 'select_motivated' | 'select_important';

export interface RecommendationTodo {
  id: string;
  title: string;
  estimatedHours: number;
  aiReasoning: string;
  quadrant: string;
}

@Component({
  selector: 'app-planner-recommendation',
  standalone: true,
  imports: [DragDropModule, TodoItemComponent, CommonModule],
  templateUrl: './planner-recommendation-component.html',
  styleUrls: ['./planner-recommendation-component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlannerRecommendationComponent {
  private plannerService = inject(PlannerService);

  // 🟢 Verwendet das echte Server-Modell mit plannerDetails & modeCode
  recommendations = input<RecommendedTodoItem[]>([]);
  
  // 🟢 Ein zentrales Output-Event für das Gesamtergebnis
  sessionCompleted = output<RecommendationResult>();

  // Lokaler Puffer innerhalb der Komponente für Ablehnungen
  private rejectionsBuffer = signal<{ todoId: string; reason: RejectReason }[]>([]);
  activePopoverId = signal<string | null>(null);

  // Verbleibende Todos im UI (ausgeblendet, wenn bereits abgelehnt)
  visibleList = computed(() => {
    const rejectedIds = new Set(this.rejectionsBuffer().map(r => r.todoId));
    return this.recommendations().filter(item => !rejectedIds.has(item.todo.id))
    .map(rec => ({
       ...rec,
       todoViewModel: new TodoViewModel(rec.todo, false)
      }) 
    );
  });

  // 🚀 Ein Todo wurde gewählt (Klick oder Drag nach oben)
  onSelect(item: RecommendedTodoItem, targetZone: string | null = null) {
    this.finishSession(item.todo.id);
  }

  // ❌ Ein Todo wurde abgelehnt (Dropzone oder Klick)
  onReject(todoId: string, reason: RejectReason) {
    // 1. Im lokalen Puffer speichern
    this.rejectionsBuffer.update(list => [...list, { todoId, reason }]);
    this.activePopoverId.set(null);

    // 2. Prüfen: Sind jetzt alle vorgeschlagenen Todos verarbeitet?
    if (this.visibleList().length === 0) {
      this.finishSession(); // Fertig, ohne gewähltes Todo
    }
  }

  // 🏁 Baut das Paket zusammen und schickt es an die Elternkomponente / den Service
  private finishSession(selectedTodoId?: string) {
    console.log("PlannerRecommendationComponent: finishSession startet", selectedTodoId);

    const result: RecommendationResult = {
      selectedTodoId: selectedTodoId,
      rejections: this.rejectionsBuffer()
    }
    this.plannerService.sendFeedback(result)

    this.sessionCompleted.emit(result);
  }

// onDrop(event: CdkDragDrop<any>, targetZone: 'select' | 'self_return' | RejectReason | AcceptReason) {
//   if (event.previousContainer === event.container) {
//     return;
//   }

//   const item = event.item.data as RecommendedTodoItem;
//   if (!item) return;

//   if (targetZone === 'self_return') {
//     return; 
//   }

//   // Если это одна из причин принятия
//   if (targetZone.startsWith('select')) {
//     console.log(`Принято с причиной: ${targetZone}`);
//     // Передаем причину вместе с выбранной задачей
//     this.onSelect(item, targetZone);
//   } else {
//     this.onReject(item.todo.id, targetZone as RejectReason);
//   }
// }

  toggleInlineMenu(todoId: string) {
    this.activePopoverId.update(id => id === todoId ? null : todoId);
  }
}