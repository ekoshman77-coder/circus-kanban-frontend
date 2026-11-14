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

  // Prüft, ob im gesamten Blueprint mindestens eine Empfehlung existiert
  get hasRecommendations(): boolean {
    const blueprint = this.dailyBlueprint();
    if (!blueprint || !blueprint.slots) return false;
    return blueprint.slots.some(slot => slot.recommendations && slot.recommendations.length > 0);
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
        console.log('Recommendation ist gekommen', data);
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

    // 🕒 Prüfen, ob das Todo zu einem aktuellen/heutigen Slot gehört oder in der Zukunft liegt
    const currentBlueprint = this.dailyBlueprint();
    let shouldActivate = true;

    if (currentBlueprint) {
      const slot = currentBlueprint.slots.find(s =>
        s.recommendations.some(r => r.todo.id === action.todoId)
      );
      if (slot) {
        shouldActivate = this.isSlotCurrentOrPast(slot.startTime);
      }
    }

    // Feedback senden + optional Todo sofort aktivieren
    this.plannerService.acceptRecommendation(action, shouldActivate);
  }

  private isSlotCurrentOrPast(startTime: string): boolean {
    if (!startTime) return true;
    const [hours, minutes] = startTime.split(':').map(Number);
    const now = new Date();
    const slotDate = new Date();
    slotDate.setHours(hours, minutes, 0, 0);

    // 30 Minuten Kulanz vor dem offiziellen Start des Slots
    return now.getTime() >= slotDate.getTime() - (30 * 60 * 1000);
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