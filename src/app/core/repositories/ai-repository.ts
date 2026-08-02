import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { aiCategoriesApiUrl, aiNoteCategoriesUrl, aiNotePredictionUrl, aiPredictionApiUrl, aiPredictionEffortUrl, aiTodoSnoozingUrl, getAiMilestonesUrl, smartPlannerFeedbackUrl, smartPlannerUrl, trackAiIgnoredMilestoneUrl, trackAiMilestoneDegradationUrl, trackAiMilestoneSelectionUrl } from './links';
import { ITodoJSON } from './dto/todo-json';
import { MilestoneSuggestionsModel } from '../models/milestone-suggestions-model';
import { IgnoredMilestones, MilestoneInteractionPayload } from './dto/tracked-milestones';
import { TodoSnoozyPayload } from './dto/todo-snoozy-payload';

/**
 *  Die internationalisierungssichere Server-Antwort für die Empfehlung
 */
export interface RecommendedTodoResponse {
  todo: ITodoJSON | null; // 🚀 Perfekt gemappt auf dein bestehendes Interface!
  modeCode: 'STANDARD' | 'RECHERCHE' | 'CLEAN_SLATE';
  reasonCode: 'DEFAULT' | 'LOW_ENERGY_SHORT_TIME' | 'NO_TODOS_LEFT';
}

export interface MilestoneSuggestion {
  title: string;
  score: number;
  words: string[]
}

export interface MilestoneSuggestionsResponse {
  recommended: MilestoneSuggestion[];
  degraded: MilestoneSuggestion[];
}

/**
 * Die Daten (Payload), die das Frontend zum Server schickt, um eine Empfehlung zu berechnen
 */
export interface PlannerRecommendationPayload {
  userId: string;
  userEnergy: string;       // "low" | "medium" | "high"
  workingTimeLeft: number;  // Die verbleibenden Stunden
}

/**
 *  Die Daten (Payload), die das Frontend zum Server schickt, wenn du Feedback gibst
 */
export interface PlannerFeedbackPayload {
  userId: string;
  todoId: string;
  accepted: boolean;
  rejectReason: 'no_motivation' | 'too_heavy' | 'too_long' | null;
  currentEnergy: string;    // "low" | "medium" | "high"
}

@Injectable({
  providedIn: 'root'
})
export class AiRepository {
  private http = inject(HttpClient);

  /**
   * Holt den KI-Vorschlag live vom Server
   */
  public getServerPrediction(text: string, contextType: 'todo' | 'note'): Observable<{ suggestedCategory: string }> {
    if (contextType === 'note') {
      return this.http.post<{ suggestedCategory: string }>(aiNotePredictionUrl, {text});
    }
    
    // Fallback für To-Dos (bleibt exakt wie vorher)
    return this.http.post<{ suggestedCategory: string }>(aiPredictionApiUrl, {text});  }

  /**
   * Alle existierenden Kategorien vom Server holen (GET)
   */
  public getServerCategories(contextType: 'todo' | 'note'): Observable<string[]> {
    // 🛠️ Wenn das IdeaBoard fragt, holen wir die reinen Zettel-Tags ohne störende Parameter!
    if (contextType === 'note') {
      return this.http.get<string[]>(aiNoteCategoriesUrl);
    }

    // Fallback für To-Dos
    return this.http.get<string[]>(`${aiCategoriesApiUrl}`);
  }
  
  /**
   * ⏱️ Holt die globale Aufwandsschätzung live vom Server
   */
  public getServerEffortPrediction(payload: { text: string; contextType: string}): Observable<{ suggestedEffort: number, benchmarkMessage: string }> {
    return this.http.post<{ suggestedEffort: number, benchmarkMessage: string }>(aiPredictionEffortUrl, payload);
  }

  /**
   * Holt die smarte Empfehlung inkl. Reason-Codes vom Server
   */
  public getPlannerRecommendation(payload: PlannerRecommendationPayload): Observable<RecommendedTodoResponse> {
    return this.http.post<RecommendedTodoResponse>(smartPlannerUrl, payload);
  }

  /**
   * Sendet das Nutzer-Feedback an den Server, damit die KI lernt
   */
  public sendPlannerFeedback(payload: PlannerFeedbackPayload): Observable<void> {
    return this.http.post<void>(smartPlannerFeedbackUrl, payload);
  }

  /**
   * Holt die Meilenstein-Vorschläge live basierend auf dem Projekttitel
   */
  public getMilestoneSuggestions(title: string, area: string, userId: string): Observable<MilestoneSuggestionsResponse> {
    // Da projectApiUrl für /api/projects steht, bauen wir den Pfad passend zusammen
    return this.http.get<MilestoneSuggestionsResponse>(getAiMilestonesUrl, {
      params: { title, area, userId }
    });
  }

  /**
   * Erfolgs-Tracking: Sagt der KI, dass eine Phase ausgewählt wurde
   */
  public trackMilestoneSelection(projectTitle: string, projectArea: string, milestoneTitle: string, userId: string): Observable<void> {
    const payload: MilestoneInteractionPayload = {
      projectTitle: projectTitle,
      area: projectArea,
      milestoneTitle: milestoneTitle,
      userId: userId
    }
    console.log("AiRepository trackMilestoneSelecton payload =", payload)
    return this.http.post<void>(trackAiMilestoneSelectionUrl, payload);
  }

  /**
   * Ignore-Tracking: sagt der KI, dass einige Phasen ignoriert wurden
   */
  public trackMilestonesIgnore(projectTitle: string, projectArea: string, userId: string, milestones: string[]): Observable<void> {
    const payload: IgnoredMilestones = {
      projectTitle: projectTitle,
      area: projectArea,
      userId: userId,
      milestoneTitles: milestones
    }
    console.log("AiRepository trackMilestoneIgnore payload =", payload)
    return this.http.post<void>(trackAiIgnoredMilestoneUrl, payload)
  }
  
  /**
   * Strafbank-Tracking: Sagt der KI, dass ein Vorschlag weggeklickt wurde
   */
  public trackMilestoneDegradation(projectTitle: string, projectArea: string, milestoneTitle: string, userId: string): Observable<void> {
    const payload: MilestoneInteractionPayload = {
      projectTitle: projectTitle,
      area: projectArea,
      milestoneTitle: milestoneTitle,
      userId: userId
    }
    console.log("AiRepository trackMilestoneDegregation payload =", payload)
    return this.http.post<void>(trackAiMilestoneDegradationUrl, payload);
  }

  public snoozyTodo(todoId: string, durationInMin: number): Observable<void> {
    const payload: TodoSnoozyPayload = {todoId: todoId, durationInMin: durationInMin}
    return this.http.post<void>(aiTodoSnoozingUrl, payload)
  }
}