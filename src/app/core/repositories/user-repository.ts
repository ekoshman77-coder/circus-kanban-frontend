import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { GamificationResult } from '../models/gamification';
import { gamificationApiUrl, settingsApiUrl, userApiUrl } from './links';

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
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

  public register(username: string, firstName: string, lastName: string, password: string): Observable<IUser> {
  console.log('📦 Angular schickt zur Registrierung:', { username, firstName, lastName })
    return this.http.post<IUser>(`${userApiUrl}/register`, { username, firstName, lastName, password }).pipe(
    tap(response => {
      // 🔍 2. SPUR: Was kommt wirklich vom Kotlin-Server zurück?
      console.log('📡 Kotlin-Server antwortet mit:', response);
    }),
    catchError((err: HttpErrorResponse) => {
      const serverErrorMessage = err.error?.message || "Ein unerwarteter Server-Fehler ist aufgetreten.";
      return throwError(() => serverErrorMessage)
    })
  );
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

  /**
   * Aktualisiert die Profildaten eines Benutzers auf dem Server
   * URL: z.B. `/api/users/profile/user_123`
   */
  public updateProfile$(userId: string, username: string, firstName: string, lastName: string): Observable<IUser> {
    console.log('📡 [UserRepo] PUT updateProfile$ abgefeuert für:', { userId, username, firstName, lastName });
    const body = { username, firstName, lastName };

  return this.http.put<IUser>(`${userApiUrl}/profile/${userId}`, body).pipe(
      tap(response => console.log('📥 [UserRepo] PUT Antwort vom Server:', response))
    );
  }

  /**
   * Löscht einen Benutzer komplett global aus der Datenbank
   * URL: z.B. `/api/users/user_123`
   */
public deleteGlobalUser$(userId: string): Observable<void> {
    console.log('📡 [UserRepo] GLOBAL DELETE deleteGlobalUser$ abgefeuert für ID:', userId);

    return this.http.delete<void>(`${userApiUrl}/${userId}`).pipe(
      tap(() => console.log(`📥 [UserRepo] GLOBAL DELETE erfolgreich vom Server bestätigt für User-ID: ${userId}`))
    );
  }
}