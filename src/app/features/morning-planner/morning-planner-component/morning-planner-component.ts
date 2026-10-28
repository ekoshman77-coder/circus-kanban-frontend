import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { PlannerService, RecommendedTodoItem } from '../../../core/services/ai/planner-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-morning-planner-component',
  imports: [CommonModule],
  templateUrl: './morning-planner-component.html',
  styleUrl: './morning-planner-component.css',
})
export class MorningPlannerComponent implements OnInit {
  public plannerService = inject(PlannerService);

  // 👈 Hier horchen wir auf das Service-Signal statt starr "true" zu setzen
  public isOpen = computed(() => this.plannerService.showMorningModal());

  ngOnInit(): void {
    // Nur laden, wenn das Modal durch den Check auch wirklich geöffnet wurde
    if (this.isOpen()) {
      this.plannerService.loadMorningRecommendation();
    }
  }

  public closeModal(): void {
    this.plannerService.dismissMorningModal(); // Setzt das Datum in den localStorage
  }

  public acceptTask(item: RecommendedTodoItem): void {
    this.plannerService.sendFeedback({
      selectedTodoId: item.todo.id,
      rejections: []
    });
    this.plannerService.dismissMorningModal();
  }

  public rejectAsTooHeavy(item: RecommendedTodoItem): void {
    this.plannerService.sendFeedback({
      rejections: [{ todoId: item.todo.id, reason: 'too_heavy' }]
    });
    this.plannerService.dismissMorningModal();
  }

  public handleNoTime(item: RecommendedTodoItem): void {
    this.plannerService.snoozyrecommendedTodo(item.todo.id, 120);
    this.plannerService.dismissMorningModal();
  }
}