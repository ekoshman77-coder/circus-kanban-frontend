import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { RecommendationCardComponent } from '../recommendation-card-component/recommendation-card-component';
import { AcceptAction, RejectAction } from '../../../core/models/recommendation-actions';
import { Todo } from '../../../core/models/todo';
import { DailyBlueprintViewModel } from '../../../core/models/recommendation-view-models';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { LocalStorageService } from '../../../core/services/user/local-storage-service';

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
  private localStorageService = inject(LocalStorageService);

  dailyBlueprint = signal<DailyBlueprintViewModel | null>(null);
  isLoading = this.plannerService.isLoading;

  // Puffer für verworfene und angenommene IDs im Tagesplan
  private rejectionsBuffer = signal<string[]>([]);
  private acceptedBuffer = signal<string[]>([]);

  private static readonly CACHE_KEY = 'daily_blueprint_cache';
  private static readonly DATE_KEY = 'daily_blueprint_date';
  private static readonly REJECTIONS_KEY = 'daily_blueprint_rejections';
  private static readonly ACCEPTED_KEY = 'daily_blueprint_accepted';

  ngOnInit() {
    this.loadPersistedBlueprint();
  }

  private loadPersistedBlueprint() {
    const savedDate = this.localStorageService.getItem<string>(BlueprintPageComponent.DATE_KEY);
    const today = new Date().toISOString().split('T')[0];

    if (savedDate === today) {
      const savedData = this.localStorageService.getItem<DailyBlueprintViewModel>(BlueprintPageComponent.CACHE_KEY);
      
      if (savedData) {
        // Wandle rohe JSON-Todos in echte Todo-Klassen-Instanzen um[cite: 4]
        if (savedData.slots) {
          savedData.slots = savedData.slots.map((slot: any) => ({
            ...slot,
            recommendations: slot.recommendations?.map((rec: any) => ({
              ...rec,
              todo: rec.todo ? Todo.fromJson(rec.todo) : rec.todo
            }))
          }));
        }

        this.dailyBlueprint.set(savedData);
      }

      // Lade auch die gespeicherten Puffer für abgelehnte und angenommene Karten
      const savedRejections = this.localStorageService.getItem<string[]>(BlueprintPageComponent.REJECTIONS_KEY);
      if (savedRejections) {
        this.rejectionsBuffer.set(savedRejections);
      }

      const savedAccepted = this.localStorageService.getItem<string[]>(BlueprintPageComponent.ACCEPTED_KEY);
      if (savedAccepted) {
        this.acceptedBuffer.set(savedAccepted);
      }
    } else {
      // Datum hat sich geändert -> Cache leeren
      this.clearPersistedBlueprint();
    }
  }

  private persistBlueprint(vm: DailyBlueprintViewModel | null) {
    const today = new Date().toISOString().split('T')[0];
    if (vm) {
      this.localStorageService.setItem(BlueprintPageComponent.CACHE_KEY, vm);
      this.localStorageService.setItem(BlueprintPageComponent.DATE_KEY, today);
    } else {
      this.clearPersistedBlueprint();
    }
  }

  private clearPersistedBlueprint() {
    this.localStorageService.removeItem(BlueprintPageComponent.CACHE_KEY);
    this.localStorageService.removeItem(BlueprintPageComponent.DATE_KEY);
    this.localStorageService.removeItem(BlueprintPageComponent.REJECTIONS_KEY);
    this.localStorageService.removeItem(BlueprintPageComponent.ACCEPTED_KEY);
  }

  private persistBuffers() {
    this.localStorageService.setItem(BlueprintPageComponent.REJECTIONS_KEY, this.rejectionsBuffer());
    this.localStorageService.setItem(BlueprintPageComponent.ACCEPTED_KEY, this.acceptedBuffer());
  }

  // Blueprint manuell anfordern
  generateBlueprint() {
    this.plannerService.loadDailyBlueprint().subscribe({
      next: data => {
        const vm = data ?? null;
        this.dailyBlueprint.set(vm);
        this.persistBlueprint(vm);
        
        // Puffer zurücksetzen und im Storage aktualisieren
        this.rejectionsBuffer.set([]);
        this.acceptedBuffer.set([]);
        this.persistBuffers();
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
    console.log('Blueprint-Aufgabe akzeptiert:', action);
    this.acceptedBuffer.update(list => [...list, action.todoId]);
    this.rejectionsBuffer.update(list => list.filter(id => id !== action.todoId));
    this.persistBuffers();
    this.plannerService.acceptRecommendation(action);
  }

  onTodoRejected(action: RejectAction) {
    console.log('Blueprint-Aufgabe abgelehnt:', action);

    if (action.reason === 'snooze') {
      this.plannerService.snoozeRecommendation({
        todoId: action.todoId,
        durationInMin: 30
      });
    }

    this.rejectionsBuffer.update(list => [...list, action.todoId]);
    this.acceptedBuffer.update(list => list.filter(id => id !== action.todoId));
    this.persistBuffers();
    this.plannerService.rejectRecommendation(action);
  }

  restoreTodo(todoId: string) {
    this.rejectionsBuffer.update(list => list.filter(id => id !== todoId));
    this.persistBuffers();
  }
}