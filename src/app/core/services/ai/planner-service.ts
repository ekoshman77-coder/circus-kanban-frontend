import { inject, Injectable, signal } from '@angular/core';
import { UserService } from '../user/user-service';
import { AiRepository } from '../../repositories/ai-repository'; 
import { Todo } from '../../models/todo';

/**
 * Interface für die Antwort des KI-Planer-Services.
 * Mappt die rohe Serverantwort in ein strukturiertes Format, das bereits ein 
 * instanziiertes Domänen-Objekt (`Todo`) enthält.
 */
export interface RecommendedTodoServiceResponse {
  /** Das transformierte Todo-Domänenobjekt oder null, wenn keine Empfehlungen vorliegen */
  todo: Todo | null;
  /** Der Modus, in dem die Empfehlung generiert wurde */
  modeCode: 'STANDARD' | 'RECHERCHE' | 'CLEAN_SLATE';
  /** Der logische Grund für die spezifische Empfehlung */
  reasonCode: 'DEFAULT' | 'LOW_ENERGY_SHORT_TIME' | 'NO_TODOS_LEFT';
}

/**
 * Service für die intelligente Tagesplanung und Aufgabenempfehlung.
 * * Kommuniziert mit dem KI-Modul im Backend über das `AiRepository`,
 * steuert den Ladezustand und transformiert nackte JSON-Daten in vollwertige
 * Domänen-Modelle (`Todo`), damit alle UI-Komponenten auf Methoden wie `getVisualStatus()` zugreifen können.
 */
@Injectable({
  providedIn: 'root'
})
export class PlannerService {
  private userService = inject(UserService);
  private aiRepository = inject(AiRepository);

  /** Signal für das aktuell empfohlene To-Do-Domänenobjekt */
  public recommendedTodo = signal<Todo | null>(null);
  
  /** Signal für die vollständigen Metadaten der aktuellen KI-Empfehlung */
  public aiResponseCode = signal<RecommendedTodoServiceResponse | null>(null);
  
  /** Signal für den aktuellen Ladezustand der KI-Anfrage */
  public isLoading = signal<boolean>(false);

  /**
   * Lädt eine personalisierte, smarte Aufgabenempfehlung basierend auf der aktuellen
   * Tagesform (Energielevel) und der verbleibenden Arbeitszeit des Benutzers.
   * * Transformiert das zurückgegebene Datenobjekt automatisch in ein echtes `Todo`-Modell.
   * * @param energy Das aktuelle Energielevel des Nutzers ('low', 'normal', 'high').
   * @param timeLeft Die verbleibende Arbeitszeit in Stunden.
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
        // 🧱 Das Domänen-Mapping:
        // Wir transformieren das JSON-DTO in eine echte Instanz unserer Todo-Klasse
        const domainTodo = response.todo ? new Todo(response.todo) : null;

        // Zustandssignale befüllen
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
   * Sendet das qualitative Nutzerfeedback zu einer Empfehlung an das Backend zurück,
   * damit die KI personalisiert dazulernen kann.
   * * Setzt bei Annahme der Aufgabe die aktuelle Empfehlung zurück, um Platz für Neues zu machen.
   * * @param todoId Die ID der bewerteten Aufgabe.
   * @param accepted Gibt an, ob der Nutzer den Vorschlag angenommen hat.
   * @param reason Der Ablehnungsgrund bei Ablehnung (z. B. 'too_heavy', 'too_long' oder 'no_motivation').
   * @param energy Das Energielevel zum Zeitpunkt der Bewertung.
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
        
        // Wenn das To-Do akzeptiert wurde, räumen wir die Empfehlung aus dem Viewport
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