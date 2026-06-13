import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GamificationResult } from '../models/gamification';
import { gamificationApiUrl, settingsApiUrl, userApiUrl } from './links';

export interface IUser {
  id: string;
  username: string;
}

// 📋 Das passende Interface für dein Kotlin-DTO
export interface PlannerSettingsDto {
  userId: string;
  defaultWorkingHours: number;
  primeTimeStartHour: number;
  primeTimeEndHour: number;
}

@Injectable({
  providedIn: 'root',
})
export class UserRepository {
  private http = inject(HttpClient);

  public login(username: string): Observable<IUser> {
    return this.http.post<IUser>(`${userApiUrl}/login`, { username });
  }

  public register(username: string): Observable<IUser> {
    return this.http.post<IUser>(`${userApiUrl}/register`, { username });
  }

  // 📥 NEU: Holt die Einstellungen aus dem Backend
  public getSettings(userId: string): Observable<PlannerSettingsDto> {
    return this.http.get<PlannerSettingsDto>(`${settingsApiUrl}/${userId}`);
  }

  // 📤 NEU: Aktualisiert die Einstellungen im Backend
  public updateSettings(userId: string, settings: PlannerSettingsDto): Observable<PlannerSettingsDto> {
    return this.http.put<PlannerSettingsDto>(`${settingsApiUrl}/${userId}`, settings);
  }

  public getGamification(userId: string): Observable<GamificationResult> {
    return this.http.get<GamificationResult>(`${gamificationApiUrl}/${userId}`);
  }
}