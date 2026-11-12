import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { aiCategoriesApiUrl, aiDailyBlueprintUrl, aiGroupPlannerUrl, aiMorningPlannerUrl, aiNoteCategoriesUrl, aiNotePredictionUrl, aiPredictionApiUrl, aiPredictionEffortUrl, aiRetrainUrl, aiSanitizationCategoriesUrl, aiSanitizationPredictionUrl, aiTodoSnoozingUrl, getAiMilestonesUrl, smartPlannerFeedbackUrl, smartPlannerUrl, trackAiIgnoredMilestoneUrl, trackAiMilestoneDegradationUrl, trackAiMilestoneSelectionUrl } from './links';
import { IgnoredMilestones, MilestoneInteractionPayload } from './dto/tracked-milestones';
import { TodoSnoozyPayload } from './dto/todo-snoozy-payload';
import { PlannerFeedbackPayload } from '../models/queue-items/planner-queue-payload';
import { PlannerGroupRecommendationPayload } from './dto/planner-group-recomendation-payload';
import { PlannerRecommendationRequest } from '../models/planner-recommendation-request';
import { DailyBlueprintResponse, MorningRecommendationsResponse, PlannerRecommendationsResponse } from './dto/planner-recommendation-response';

export interface MilestoneSuggestion {
  title: string;
  score: number;
  words: string[]
}

export interface MilestoneSuggestionsResponse {
  recommended: MilestoneSuggestion[];
  degraded: MilestoneSuggestion[];
}

@Injectable({
  providedIn: 'root'
})
export class AiRepository {
  private http = inject(HttpClient);

/**
   * Holt den KI-Vorschlag live vom Server (unterstützt jetzt auch Sanitization mit 2 Parametern!)
   */
  public getServerPrediction(
    text: string, 
    contextType: 'todo' | 'note' | 'sanitization', 
    patternType?: string
  ): Observable<{ suggestedCategory: string }> {
    console.log("AiRepository getServerPrediction")
    if (contextType === 'note') {
      return this.http.post<{ suggestedCategory: string }>(aiNotePredictionUrl, { text });
    }
    if (contextType === 'sanitization') {
      // 🎯 Übergibt jetzt exakt selectedText und patternType an das neue Backend-DTO!
      return this.http.post<{ suggestedCategory: string }>(aiSanitizationPredictionUrl, { 
        selectedText: text, 
        patternType: patternType ?? 'EXACT' 
      });
    }
    
    // Fallback für To-Dos
    return this.http.post<{ suggestedCategory: string }>(aiPredictionApiUrl, { text });
  }

  /**
   * Alle existierenden Kategorien vom Server holen (GET)
   */
  public getServerCategories(contextType: 'todo' | 'note' | 'sanitization'): Observable<string[]> {
    if (contextType === 'note') {
      return this.http.get<string[]>(aiNoteCategoriesUrl);
    }
    if (contextType === 'sanitization') {
      // 🎯 Nutzt nun den zentralen Link
      return this.http.get<string[]>(aiSanitizationCategoriesUrl);
    }

    // Fallback für To-Dos
    return this.http.get<string[]>(aiCategoriesApiUrl);
  }
    
  /**
   * ⏱️ Holt die globale Aufwandsschätzung live vom Server
   */
  public getServerEffortPrediction(payload: { text: string; contextType: string}): Observable<{ suggestedEffort: number, benchmarkMessage: string }> {
    return this.http.post<{ suggestedEffort: number, benchmarkMessage: string }>(aiPredictionEffortUrl, payload);
  }

  /**
   * Holt die 2 Vorschläge inkl. roundId vom Server
   */
  public getPlannerRecommendation(payload: PlannerRecommendationRequest): Observable<PlannerRecommendationsResponse> {
    console.log("AiRepository:: Start loading recommendation", payload) 
    return this.http.post<PlannerRecommendationsResponse>(smartPlannerUrl, payload);
  }

  /**
   * 🌅 Holt den vollständigen Tages-Blueprint für den Morning Energy Modus
   */
  public getDailyBlueprint(): Observable<DailyBlueprintResponse> {
    console.log("AiRepository:: Start loading daily blueprint");
    return this.http.get<DailyBlueprintResponse>(aiDailyBlueprintUrl); 
  }
  
  /**
   * Sendet das präzise Runden-Feedback an den Server
   */
  public sendPlannerFeedback(payload: PlannerFeedbackPayload): Observable<void> {
    console.log("AiRepository:: Start sending feedback", payload) 
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
    const payload: TodoSnoozyPayload = { todoId, durationInMin };
    return this.http.post<void>(aiTodoSnoozingUrl, payload);
  }

  /**
   * ☕ Holt die morgendliche Top-Empfehlung für den Start
   */
  public getMorningRecommendation(): Observable<MorningRecommendationsResponse> {
    console.log("AiRepository:: Start loading morning recommendation");
    return this.http.get<MorningRecommendationsResponse>(aiMorningPlannerUrl);
  }

  /**
   * 🎯 Holt Empfehlungen basierend auf der bewussten Gruppenwahl nach Task-Abschluss
   */
  public getGroupRecommendation(desiredGroup: string): Observable<PlannerRecommendationsResponse> {
    const payload: PlannerGroupRecommendationPayload = { desiredGroup };
    console.log("AiRepository:: Start loading group recommendation", payload);
    return this.http.post<PlannerRecommendationsResponse>(aiGroupPlannerUrl, payload);
  }

  // retrain ai
  public retrainAi(): Observable<void>{
    console.log("AiRepository:: Start retrin Ai");
    return this.http.post<void>(aiRetrainUrl, {});     
  }
}