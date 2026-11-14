import { computed, inject, Injectable, signal } from '@angular/core';
import { UserService } from '../user/user-service';
import { AiRepository } from '../../repositories/ai-repository';
import { Todo } from '../../models/todo';
import { ConnectionService } from '../connection/connection-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { AcceptAction, RejectAction, SnoozeAction } from '../../models/recommendation-actions';
import { PlannerDataManagerService } from './planner-data-manager-service';
import { PlannerRecommendationsResponse, DailyBlueprintResponse, PlannerRecommendationDetail, PlannerRecommendationItem, MorningRecommendationsResponse, MorningRecommendationItem } from '../../repositories/dto/planner-recommendation-response';
import { TodoService } from '../todo/todo-service';
import { DailyBlueprintViewModel, PlannerRecommendationViewModel, RecommendedTodoItem } from '../../models/recommendation-view-models';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { NotificationService } from '../notification/notification-service';

@Injectable({
  providedIn: 'root'
})
export class PlannerService extends BaseDataManager {
  private userService = inject(UserService);
  private todoService = inject(TodoService);
  private aiRepository = inject(AiRepository);
  private connectionService = inject(ConnectionService);
  private plannerDataManager = inject(PlannerDataManagerService);
  private notificationService = inject(NotificationService)

  //  public readonly activeRoundId = signal<string | null>(null);
  public readonly isLoading = signal<boolean>(false);
  public readonly showMorningModal = signal<boolean>(false);
  public readonly showPlannerModal = signal<boolean>(false);
  public readonly currentPlannerGroup = signal<string>("")

  private allTodos = this.todoService.allTodos

  /**
   * 🗺️ Daily Blueprint ViewModel: Löst `todoId`s zentral über den TodoService auf
   */
  public createblueprintViewModel(response: DailyBlueprintResponse): DailyBlueprintViewModel {

    return {
      roundId: response.roundId,
      userId: response.userId,
      generatedAtHour: response.generatedAtHour,
      slots: response.slots.map(slotDto => {
        const recommendations = slotDto.recommendations ?? [];

        const recommendationItems: RecommendedTodoItem[] = recommendations
          .map(recItem => this.mapItemToRecommendedTodoItem(recItem))
          .filter((item): item is RecommendedTodoItem => item !== null);

        return {
          startTime: slotDto.startTime,
          endTime: slotDto.endTime,
          energyLevel: slotDto.energyLevel,
          reason: slotDto.reason,
          recommendations: recommendationItems
        };
      })
    };
  };

  /**
   * 🔄 Hilfsmethode: Wandelt unifiziert ein `PlannerRecommendationItem` (ID + Details)
   * mithilfe der lokalen Todo-Liste in ein vollwertiges UI-Item um.
   */
  private mapItemToRecommendedTodoItem(
    recItem: PlannerRecommendationItem
  ): RecommendedTodoItem | null {
    console.log('🔍 Mappte Item ID vom Server:', recItem.todoId);

    const foundTodo = this.allTodos().find(t => {
      // Wir prüfen hier testhalber auch, ob es vielleicht an Typen (String vs. Number) oder Leerzeichen liegt
      return t.id === recItem.todoId;
    });

    if (!foundTodo) {
      console.warn(`❌ KEIN MATCH für Server-ID: "${recItem.todoId}". Vorhandene IDs sind:`, this.allTodos().map(t => t.id));
      return null;
    }

    return {
      todo: foundTodo,
      plannerDetails: recItem.plannerDetails,
      modeCode: recItem.modeCode ?? 'STANDARD'
    };
  }
  
  /**
   * 🎯 Nimmt eine unifizierte Server-Antwort entgegen und löst die darin enthaltenen IDs auf.
   */
  private handleRecommendationsResponse(response: PlannerRecommendationsResponse): PlannerRecommendationViewModel {
    console.log('🔍 Service: Rohe Server-Antwort empfangen:', response);
    console.log('🔍 Service: Aktuelle Todos im TodoService:', this.allTodos());

    const mappedItems: RecommendedTodoItem[] = response.recommendations
      .map(item => this.mapItemToRecommendedTodoItem(item))
      .filter((item): item is RecommendedTodoItem => item !== null);

    console.log('🔍 Service: Erfolgreich gemappte Items:', mappedItems);

    this.isLoading.set(false);
    return { 
      roundId: response.roundId,
      recommendations: mappedItems
    }
  }

  private mapMorningRecommendationItem(item: MorningRecommendationItem): RecommendedTodoItem {
    console.log('🔍 Service: Rohe Server-Antwort empfangen:', item);
   const mappedTodo = Todo.fromJson(item.todo);
   return {
      todo: mappedTodo,
      plannerDetails: item.plannerDetails,
      modeCode: 'STANDARD'
   }  

  }
  // --- Modal Steuerung ---

  public checkMorningState(): void {
    const now = new Date();
    const currentHour = now.getHours();
    const isMorningTime = currentHour >= 5 && currentHour < 12;
    const todayString = now.toISOString().split('T')[0];
    const lastShownDate = this.localStorageService.getItem('last_morning_greeting_date');

    if (lastShownDate === todayString) {
      return;
    }

    if (isMorningTime) {
      if (this.connectionService.isOffline()) {
        this.localStorageService.setItem('last_morning_greeting_date', todayString);
        return;
      }
      this.showMorningModal.set(true);
    }
  }

  public dismissMorningModal(): void {
    const todayString = new Date().toISOString().split('T')[0];
    this.localStorageService.setItem('last_morning_greeting_date', todayString);
    this.showMorningModal.set(false);
  }

  public closePlannerModal(): void {
    this.showPlannerModal.set(false);
  }

  public openPlannerModal(group: string): void {
    this.currentPlannerGroup.set(group);
    this.showPlannerModal.set(true)
  }

  public retrainAi(): void {
     this.plannerDataManager.queueRetrainAi();
     this.notificationService.showNotification(
      '🚀 KI-Weiterbildung wurde erfolgreich in die Warteschlange eingereiht!',
      'success'
    );
  }

  // --- Empfehlungen Laden (Die 4 Typen) ---

  /**
   * 1️⃣ Smart Recommendation
   */
  public loadSmartRecommendation(energy: 'LOW' | 'MEDIUM' | 'HIGH', timeLeft: number): Observable<PlannerRecommendationViewModel | null> {
    const currentUserId = this.userService.getCurrentUserId() ?? '';
    this.isLoading.set(true);

    return this.aiRepository.getPlannerRecommendation({
      userId: currentUserId,
      userEnergy: energy,
      workingTimeLeft: timeLeft
    }).pipe(
      map(response => this.handleRecommendationsResponse(response)),
      finalize(() => this.isLoading.set(false))
    );
  }

  /**
     * 2️⃣ Morning Recommendation (Steuert das Modal direkt über den Erfolg)
     */
  public loadMorningRecommendation(): Observable<PlannerRecommendationViewModel | null> {
    if (this.connectionService.isOffline()) return of(null);

    this.isLoading.set(true);

    return this.aiRepository.getMorningRecommendation().pipe(
       map(response => {
         const roundId = response.roundId;
         const recs = response.recommendations.map(rec => this.mapMorningRecommendationItem(rec))
         const vm: PlannerRecommendationViewModel = {
            roundId: roundId,
            recommendations: recs
         }
         return vm
      }),
       finalize(() => {
         this.isLoading.set(false)
       })
    )
  }

  /**
   * 3️⃣ Group Recommendation
   */
  public loadRecommendationsByGroup(desiredGroup: string): Observable<PlannerRecommendationViewModel | null> {
    if (this.connectionService.isOffline()) return of(null);

    this.isLoading.set(true);

    return this.aiRepository.getGroupRecommendation(desiredGroup).pipe(
      map(response => this.handleRecommendationsResponse(response)),
      finalize(() => {
        this.isLoading.set(false)
      })
    ) 
  }

  /**
   * 4️⃣ Daily Blueprint
   */
  public loadDailyBlueprint(): Observable<DailyBlueprintViewModel | null> {
    if (this.connectionService.isOffline()) return of(null);

    this.isLoading.set(true);

    return this.aiRepository.getDailyBlueprint().pipe(
      map(response => this.createblueprintViewModel(response)
      ),
      finalize(() => this.isLoading.set(false))
    )
  }

  // --- Feedback-Aktionen (Rein an den DataManager weiterleiten) ---

  /**
   * ✅ Todo Akzeptieren
   */
public acceptRecommendation(action: AcceptAction, shouldActivate: boolean = true): void {
  const currentUserId = this.userService.getCurrentUserId() ?? '';

  if (shouldActivate) {
    const todo = this.todoService.getTodoById(action.todoId);
    if (todo) {
      let updatedTodo = todo.cloneWith({ isStarted: true });

      // Wenn es ein offenes Team-/Projekt-Todo ist, dem User zuweisen und auf IN_PROGRESS setzen
      if (todo.milestoneId && todo.milestoneId.trim() !== '' && (!todo.assignedUserId || todo.assignedUserId.trim() === '')) {
        updatedTodo = updatedTodo.cloneWith({
          assignedUserId: currentUserId,
          teamStatus: 'IN_PROGRESS',
          isStarted: true
        });
      }

      this.todoService.updateTodo(updatedTodo);
    }
  }

  // KI-Feedback wie gewohnt in die Queue einreihen
  this.plannerDataManager.queueFeedback(currentUserId, action, []);
}

  /**
   * ❌ Todo Ablehnen
   */
  public rejectRecommendation(action: RejectAction): void {
    const currentUserId = this.userService.getCurrentUserId() ?? '';
    this.plannerDataManager.queueFeedback(currentUserId, null, [action]);
  }

  /**
   * 💤 Todo Snoozen
   */
  public snoozeRecommendation(action: SnoozeAction): void {
    this.plannerDataManager.queueSnooze(action.todoId, action.durationInMin);
  }

  private clearLocalActiveRecommendations(): void {
    this.currentPlannerGroup.set("");
    this.isLoading.set(false);
  }

  public override resetData(): void {
    this.clearLocalActiveRecommendations();
    this.localStorageService.removeItem('last_morning_greeting_date');
  }

  public clearRecommendations(): void {
    this.resetData();
  }

  public override checkUnsavedData(): string | null {
    return null;
  }
}