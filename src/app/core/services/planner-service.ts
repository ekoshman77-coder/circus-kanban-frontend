import { inject, Injectable, signal } from '@angular/core';
import { UserService } from './user/user-service';
import { AiRepository, RecommendedTodoResponse } from '../repositories/ai-repository'; 
import { Todo } from '../models/todo'; // 👈 Wir importieren deine echte Klasse!

// Wir bauen uns ein Interface für die Service-Antwort, die bereits die echte Domänen-Klasse enthält
export interface RecommendedTodoServiceResponse {
  todo: Todo | null; // 🚀 Hier fließt jetzt das echte, fette Todo-Objekt mit allen Methoden!
  modeCode: 'STANDARD' | 'RECHERCHE' | 'CLEAN_SLATE';
  reasonCode: 'DEFAULT' | 'LOW_ENERGY_SHORT_TIME' | 'NO_TODOS_LEFT';
}

@Injectable({
  providedIn: 'root'
})
export class PlannerService {
  private userService = inject(UserService);
  private aiRepository = inject(AiRepository);

  // 🚦 Die Signals arbeiten ab jetzt mit der echten Domänen-Klasse 'Todo'!
  public recommendedTodo = signal<Todo | null>(null);
  public aiResponseCode = signal<RecommendedTodoServiceResponse | null>(null);
  public isLoading = signal<boolean>(false);

  /**
   * ✨ Holt die Empfehlung und mappt das nackte JSON in ein echtes Todo-Objekt
   */
  public loadSmartRecommendation(energy: string, timeLeft: number): void {  
    const currentUserId = this.userService.getCurrentUserId();
    
    this.isLoading.set(true);

    this.aiRepository.getPlannerRecommendation({
      userId: currentUserId ?? "",
      userEnergy: energy, 
      workingTimeLeft: timeLeft 
    })
    .subscribe({
      next: (response) => {
        // 🧱 DAS MAGISCHE MAPPING:
        // Dein Konstruktor nimmt das JSON und baut ein echtes Todo mit allen Methoden (wie getVisualStatus)!
        const domainTodo = response.todo ? new Todo(response.todo) : null;

        // Jetzt befüllen wir die Signals mit dem sauberen Domänen-Model
        this.recommendedTodo.set(domainTodo);
        
        this.aiResponseCode.set({
          todo: domainTodo,
          modeCode: response.modeCode,
          reasonCode: response.reasonCode
        });

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der KI-Empfehlung:', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * 👎/🚀 Sende das Feedback an den Server
   */
  public sendFeedback(
    todoId: string, 
    accepted: boolean, 
    reason: 'no_motivation' | 'too_heavy' | 'too_long' | null, 
    energy: string
  ): void {
    const currentUserId = this.userService.getCurrentUserId();

    this.aiRepository.sendPlannerFeedback({ 
      userId: currentUserId ?? "",
      todoId: todoId, 
      accepted: accepted, 
      rejectReason: reason, 
      currentEnergy: energy 
    })
    .subscribe({
      next: () => {
        console.log('🧠 KI hat das Feedback erfolgreich gelernt!');
        
        if (accepted) {
          this.recommendedTodo.set(null);
          this.aiResponseCode.set(null);
        }
      },
      error: (err) => {
        console.error('Fehler beim Senden des KI-Feedbacks:', err);
      }
    });
  }
}