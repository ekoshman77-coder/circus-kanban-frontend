import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { UserModel } from '../models/user-model';
import { teamApiUrl, userApiUrl } from './links';
import { IUserJSON } from './dto/user-json';

@Injectable({
  providedIn: 'root'
})
export class TeamRepository {
  private http = inject(HttpClient);

  /**
   * 📥 AUFGABE 1: GET-Request
   * Hole alle Teammitglieder, die dem Projekt mit der 'projectId' zugewiesen sind.
   * Die URL auf dem Kotlin-Server lautet: `${teamApiUrl}/${projectId}/members`
   */
  public getMembersForProject$(projectId?: string | null): Observable<UserModel[]> {
    console.log('📡 [TeamRepo] GET getMembersForProject$ aufgerufen für Projekt:', projectId);
    let params = new HttpParams();

    if (projectId) {
      params = params.set('projectId', projectId);
    }

    return this.http.get<IUserJSON[]>(teamApiUrl, { params }).pipe(
      tap(jsonArray => console.log('📥 [TeamRepo] GET Antwort vom Server (unverarbeitet):', jsonArray)),
      map(jsonArray => jsonArray.map(user => UserModel.fromJson(user))),
      tap(models => console.log('🎯 [TeamRepo] GET in UserModel konvertiert:', models))
    );
  }
  /**
  * ➕ Weist einen bestehenden User einem bestimmten Projekt zu
  */
  /**
    * ➕ POST: Weist einen bestehenden User einem bestimmten Projekt zu
    * Schießt jetzt sauber auf die Basis-Route des Controllers!
    */
  /**
    * ➕ POST: Weist einen bestehenden User einem bestimmten Projekt zu
    * Schießt jetzt sauber auf die Basis-Route des Controllers!
    */
  public assignUserToProject$(projectId: string, member: UserModel): Observable<UserModel> {
    console.log('📡 [TeamRepo] POST assignUserToProject$ abgefeuert:', { projectId, memberId: member.id });

    // Wir packen die projectId als Query-Parameter an die Basis-URL (?projectId=...)
    const params = new HttpParams().set('projectId', projectId);

    // Wir senden das vom Server erwartete DTO { userId: "..." } im Body mit!
    const body = { userId: member.id };

    return this.http.post<IUserJSON>(teamApiUrl, body, { params }).pipe(
      tap(response => console.log('📥 [TeamRepo] POST Antwort vom Server:', response)),
      map(json => UserModel.fromJson(json)),
      tap(model => console.log('🎯 [TeamRepo] POST erfolgreich verarbeitet:', model))
    );
  }

  /**
   * 🗑️ DELETE: User aus dem Projekt entfernen
   * Schießt auf: http://localhost:8080/api/teams/{memberId}?projectId={projectId}
   */
  public deleteFromProject$(projectId: string, memberId: string): Observable<void> {
    console.log('📡 [TeamRepo] DELETE deleteFromProject$ abgefeuert:', { projectId, memberId });

    const params = new HttpParams().set('projectId', projectId);

    return this.http.delete<void>(`${teamApiUrl}/${memberId}`, { params }).pipe(
      tap(() => console.log(`📥 [TeamRepo] DELETE erfolgreich vom Server bestätigt!`))
    );
  }

  /**
   * 🪣 AUFGABE 4: BULK-SYNC POST-Request (Offline-Änderungen abgleichen)
   * URL: `${teamApiUrl}/${projectId}/members/bulk-sync`
   * Der Server erwartet im Body ein Objekt mit einem Array aller User-IDs: 
   * { memberIds: ["id1", "id2", ...] }
   * Als Antwort spuckt er uns wieder das bereinigte, volle Array <UserModel[]> aus!
   */
  public bulkSyncForProject$(projectId: string, localList: UserModel[]): Observable<UserModel[]> {
    const params = new HttpParams().set('projectId', projectId);
    const body = { memberIds: localList.map(m => m.id) };

    const result = this.http.post<IUserJSON[]>(`${teamApiUrl}/bulk`, body, { params }).pipe(
      map(jsonArray => jsonArray.map(json => UserModel.fromJson(json)))
    );

    return result;
  }

  public getAllGlobalUsers$(): Observable<UserModel[]> {
    return this.http.get<IUserJSON[]>(`${userApiUrl}`).pipe(
      map(jsonArray => jsonArray.map(user => UserModel.fromJson(user)))
    );
  }

  public updateCoffeeAccount$(userId: string, balance: number, role: string, emoji: string): Observable<UserModel> {
    const params = new HttpParams()
      .set('balance', balance.toString())
      .set('role', role)
      .set('emoji', emoji);

    return this.http.put<IUserJSON>(`${teamApiUrl}/${userId}/coffee-account`, null, { params }).pipe(
      map(json => UserModel.fromJson(json))
    );
  }
}