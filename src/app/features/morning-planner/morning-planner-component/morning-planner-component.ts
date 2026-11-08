import { Component, computed, effect, inject, signal } from '@angular/core';
import { PlannerService, RecommendedTodoItem } from '../../../core/services/ai/planner-service';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { PlannerRecommendationViewModel } from '../../../core/models/recommendation-view-models';

@Component({
  selector: 'app-morning-planner-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './morning-planner-component.html',
  styleUrl: './morning-planner-component.css',
})
export class MorningPlannerComponent {
  public plannerService = inject(PlannerService);

  public isOpen = computed(() => this.plannerService.showMorningModal());
  public isLoading = signal<boolean>(false);

  // 🎯 Lokaler State für das Modal (kein Service-Zustand mehr)
  public currentRoundId = signal<string>('');
  public currentRecommendations = signal<RecommendedTodoItem[]>([]);

  constructor() {
    // 🎯 Reagiert reaktiv, sobald das Modal geöffnet wird
    effect(() => {
      if (this.isOpen()) {
        this.loadRecommendations();
      }
    });
  }

  private loadRecommendations(): void {
    this.isLoading.set(true);

    this.plannerService.loadMorningRecommendation().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (vm: PlannerRecommendationViewModel | null) => {
        if (vm) {
          this.currentRoundId.set(vm.roundId);
          this.currentRecommendations.set(vm.recommendations);
        }
      },
      error: (err) => {
        console.error('Fehler beim Laden des Morning-Modals:', err);
      }
    });
  }

  public closeModal(): void {
    // Lokale Daten beim Schließen zurücksetzen
    this.currentRecommendations.set([]);
    this.currentRoundId.set('');
    this.plannerService.dismissMorningModal();
  }

  public acceptTask(item: RecommendedTodoItem): void {
    this.plannerService.acceptRecommendation({
      roundId: this.currentRoundId(),
      todoId: item.todo.id,
      reason: 'select_motivated'
    });
    this.closeModal();
  }

  public rejectAsTooHeavy(item: RecommendedTodoItem): void {
    this.plannerService.rejectRecommendation({
      roundId: this.currentRoundId(),
      todoId: item.todo.id,
      reason: 'too_heavy'
    });
    this.closeModal();
  }

  public handleNoTime(item: RecommendedTodoItem): void {
    this.plannerService.snoozeRecommendation({
      todoId: item.todo.id,
      durationInMin: 120
    });
    this.closeModal();
  }
}