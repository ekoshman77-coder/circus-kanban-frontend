import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerService, RecommendedTodoItem } from '../../../core/services/ai/planner-service';
import { PlannerRecommendationComponent } from '../../planner/planner-recommendation-component/planner-recommendation-component';

@Component({
  selector: 'app-group-planner-modal',
  standalone: true,
  imports: [CommonModule, PlannerRecommendationComponent],
  templateUrl: './group-planner-component.html',
  styleUrl: './group-planner-component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupPlannerModalComponent {
  public plannerService = inject(PlannerService);

  // Lokaler State für die Modal-Daten
  public isLoading = signal<boolean>(false);
  public currentRoundId = signal<string>('');
  public currentRecommendations = signal<RecommendedTodoItem[]>([]);

  constructor() {
    // 🎯 Reagiert automatisch, sobald sich die Gruppe ändert oder das Modal getriggert wird
    effect(() => {
      const group = this.plannerService.currentPlannerGroup();
      if (group) {
        this.loadRecommendations(group);
      }
    });
  }

  private loadRecommendations(group: string): void {
    this.isLoading.set(true);

    this.plannerService.loadRecommendationsByGroup(group).subscribe({
      next: (vm) => {
        if (vm) {
          this.currentRoundId.set(vm.roundId);
          this.currentRecommendations.set(vm.recommendations);
        }
      },
      error: (err) => {
        console.error('Fehler beim Laden im Modal:', err);
      }
    });
  }

  public closeModal(): void {
    // Lokale Daten beim Schließen aufräumen
    this.currentRecommendations.set([]);
    this.currentRoundId.set('');
    this.plannerService.closePlannerModal();
  }
}