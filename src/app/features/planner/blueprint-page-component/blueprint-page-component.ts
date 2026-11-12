import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { BlueprintStorageService } from '../../../core/services/ai/blueprint-storage-service';
import { RecommendationCardComponent } from '../recommendation-card-component/recommendation-card-component';
import { AcceptAction, RejectAction } from '../../../core/models/recommendation-actions';
import { DailyBlueprintViewModel } from '../../../core/models/recommendation-view-models';
import { NotificationService } from '../../../core/services/notification/notification-service';

@Component({
  selector: 'app-blueprint-modal',
  standalone: true,
  imports: [CommonModule, RecommendationCardComponent],
  templateUrl: './blueprint-page-component.html',
  styleUrl: './blueprint-page-component.css'
})
export class BlueprintPageComponent implements OnInit {
  private plannerService = inject(PlannerService);
  private notificationService = inject(NotificationService);
  private blueprintStorage = inject(BlueprintStorageService);

  dailyBlueprint = signal<DailyBlueprintViewModel | null>(null);
  isLoading = this.plannerService.isLoading;

  private rejectionsBuffer = signal<string[]>([]);
  private acceptedBuffer = signal<string[]>([]);

  ngOnInit() {
    this.loadPersistedBlueprint();
  }

  private loadPersistedBlueprint() {
    const savedData = this.blueprintStorage.getPersistedBlueprint();
    if (savedData) {
      this.dailyBlueprint.set(savedData);
    }

    const { rejections, accepted } = this.blueprintStorage.getPersistedBuffers();
    this.rejectionsBuffer.set(rejections);
    this.acceptedBuffer.set(accepted);
  }

  generateBlueprint() {
    this.plannerService.loadDailyBlueprint().subscribe({
      next: data => {
        const vm = data ?? null;
        this.dailyBlueprint.set(vm);
        this.blueprintStorage.persistBlueprint(vm);
        
        this.rejectionsBuffer.set([]);
        this.acceptedBuffer.set([]);
        this.blueprintStorage.persistBuffers([], []);
      },
      error: err => {
        console.error(`Fehler bei loading Recommendation ${err}`);
        this.notificationService.showNotification(`Fehler bei loading Recommendation ${err}`, 'error');
      } 
    });
  }

  isRejected(todoId: string): boolean {
    return this.rejectionsBuffer().includes(todoId);
  }

  isAccepted(todoId: string): boolean {
    return this.acceptedBuffer().includes(todoId);
  }

  onTodoAccepted(action: AcceptAction) {
    this.acceptedBuffer.update(list => [...list, action.todoId]);
    this.rejectionsBuffer.update(list => list.filter(id => id !== action.todoId));
    this.blueprintStorage.persistBuffers(this.rejectionsBuffer(), this.acceptedBuffer());
    this.plannerService.acceptRecommendation(action);
  }

  onTodoRejected(action: RejectAction) {
    if (action.reason === 'snooze') {
      this.plannerService.snoozeRecommendation({
        todoId: action.todoId,
        durationInMin: 30
      });
    }

    this.rejectionsBuffer.update(list => [...list, action.todoId]);
    this.acceptedBuffer.update(list => list.filter(id => id !== action.todoId));
    this.blueprintStorage.persistBuffers(this.rejectionsBuffer(), this.acceptedBuffer());
    this.plannerService.rejectRecommendation(action);
  }

  unacceptTodo(todoId: string) {
    this.acceptedBuffer.update(list => list.filter(id => id !== todoId));
    this.blueprintStorage.persistBuffers(this.rejectionsBuffer(), this.acceptedBuffer());
  }

  restoreTodo(todoId: string) {
    this.rejectionsBuffer.update(list => list.filter(id => id !== todoId));
    this.blueprintStorage.persistBuffers(this.rejectionsBuffer(), this.acceptedBuffer());
  }
}