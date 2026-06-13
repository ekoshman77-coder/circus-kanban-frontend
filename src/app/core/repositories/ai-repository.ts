import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { aiCategoriesApiUrl, aiPredictionApiUrl } from './links';

@Injectable({
  providedIn: 'root'
})
export class AiRepository {
  private http = inject(HttpClient);

  /**
   * Holt den KI-Vorschlag live vom Server
   */
public getServerPrediction(payload: { text: string; contextType: string; userId: string }): Observable<{ suggestedCategory: string }> {
    return this.http.post<{ suggestedCategory: string }>(aiPredictionApiUrl, payload);
  }

  /**
   * 📋 Alle existierenden Kategorien vom Server holen (GET)
   */
  public getServerCategories(contextType: string, userId: string): Observable<string[]> {
    return this.http.get<string[]>(`${aiCategoriesApiUrl}?contextType=${contextType}&userId=${userId}`);
  }}