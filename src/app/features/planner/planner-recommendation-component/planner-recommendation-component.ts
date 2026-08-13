import { Component, input, output, signal, computed } from '@angular/core';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { RecommendationResult, RejectReason } from '../../../core/models/recommendation-result';
import { RecommendedTodoItem } from '../../../core/services/ai/planner-service';

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
  imports: [DragDropModule],
  templateUrl: './planner-recommendation-component.html',
  styleUrls: ['./planner-recommendation-component.css']
})
export class PlannerRecommendationComponent {
  // 🟢 Verwendet jetzt das echte Server-Modell
  recommendations = input<RecommendedTodoItem[]>([]);
  
  // 🟢 Ein zentrales Output-Event für das Gesamtergebnis
  sessionCompleted = output<RecommendationResult>();

  // Lokaler Puffer innerhalb der Komponente für Ablehnungen
  private rejectionsBuffer = signal<{ todoId: string; reason: RejectReason }[]>([]);
  activePopoverId = signal<string | null>(null);

  // Verbleibende Todos im UI (ausgeblendet, wenn bereits abgelehnt)
  visibleList = computed(() => {
    const rejectedIds = new Set(this.rejectionsBuffer().map(r => r.todoId));
    return this.recommendations().filter(item => !rejectedIds.has(item.todo.id));
  });

  // 🚀 Ein Todo wurde gewählt (Klick oder Drag nach oben)
  onSelect(item: RecommendedTodoItem) {
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
    console.log("PlannerRecomendationComponent: finishSession startet", selectedTodoId)
    this.sessionCompleted.emit({
      selectedTodoId: selectedTodoId,
      rejections: this.rejectionsBuffer()
    });
  }

  onDrop(event: CdkDragDrop<any>, targetZone: 'select' | RejectReason) {
    const item = event.item.data as RecommendedTodoItem;
    if (!item) return;

    if (targetZone === 'select') {
      this.onSelect(item);
    } else {
      this.onReject(item.todo.id, targetZone);
    }
  }

  toggleInlineMenu(todoId: string) {
    this.activePopoverId.update(id => id === todoId ? null : todoId);
  }
}