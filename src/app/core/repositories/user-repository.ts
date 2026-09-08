import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { GamificationResult } from '../models/gamification';
import { gamificationApiUrl, settingsApiUrl, userApiUrl } from './links';
import { IDepartment } from './dto/deparment-json';

export interface IUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  department?: IDepartment | null;  // Kommt jetzt sauber mit!
  isApproved: boolean;          // Kommt jetzt sauber mit!
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

  public login(username: string, password: string): Observable<IUser> {
    return this.http.post<IUser>(`${userApiUrl}/login`, { username, password });
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
    const body = { firstName, lastName };

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

  /**
  * Erstellt einen neuen Benutzer durch einen Admin/Manager.
  * Ruft POST /api/users auf (Session bleibt erhalten!).
  */
  public createUser(user: { username: string; firstName: string; lastName: string; password: string }): Observable<IUser> {
    return this.http.post<IUser>(userApiUrl, user);
  }

  public approveUser(userId: string, departmentId: string, role: string): Observable<IUser> {
    console.log('📡 [UserRepo] approve user abgefeuert für ID:', userId);

    const payload = {
      departmentId: departmentId,
      departmentRole: role
    }
    return this.http.post<IUser>(`${userApiUrl}/${userId}/approve`, payload).pipe(
      tap(() => console.log(`📥 [UserRepo] approving vom Server bestätigt für User-ID: ${userId}`))
    )
  }

  public getUserStatus(userId: string): Observable<IUser> {
    console.log('📡 [UserRepo] GET getUserStatus abgefeuert für ID:', userId);

    return this.http.get<IUser>(`${userApiUrl}/status/${userId}`).pipe(
      tap(response => console.log('📥 [UserRepo] GET Status-Antwort vom Server:', response))
    );
  }

  public logout(): Observable<void> {
    console.log(' [UserRepo] Logout');
    return this.http.post<void>('http://localhost:8080/api/users/signout', {})
  }
}