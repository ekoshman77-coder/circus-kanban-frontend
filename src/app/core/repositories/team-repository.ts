import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { ProjectRole, UserModel } from '../models/user-model';
import { teamApiUrl, userApiUrl } from './links';
import { IUserJson } from './dto/user-json';
import { ProjectMember } from '../models/project-member';

@Injectable({
  providedIn: 'root'
})
export class TeamRepository {
  private http = inject(HttpClient);

  /** 📥 Holt alle Projektmitglieder inklusive ihrer Rollen */
  public getMembersForProject$(projectId?: string | null): Observable<ProjectMember[]> {
    console.log('📡 [TeamRepo] GET getMembersForProject$ für Projekt:', projectId);
    let params = new HttpParams();
    if (projectId) {
      params = params.set('projectId', projectId);
    }

    return this.http.get<any[]>(teamApiUrl, { params }).pipe(
      map(jsonArray => jsonArray.map(json => {
        return new ProjectMember(
          UserModel.fromJson(json.user || json),
          (json.projectRole as ProjectRole) || 'DEVELOPER'
        );
      }))
    );
  }

  /** ➕ Weist einen bestehenden User einem Projekt mit einer spezifischen Rolle zu */
  public assignToProject$(projectId: string, memberId: string, role: ProjectRole): Observable<ProjectMember> {
    console.log(`📡 [TeamRepo] POST assignToProject$ - Projekt: ${projectId}, User: ${memberId}, Rolle: ${role}`);

    // 🎯 WICHTIG: NUR teamApiUrl benutzen, kein extra '/assign' anfügen!
    const url = teamApiUrl;

    // 1. Die Query-Parameter für das Backend
    const params = new HttpParams()
      .set('projectId', projectId)
      .set('role', role);

    // 2. Das JSON-Objekt für den @RequestBody
    const body = {
      userId: memberId
    };

    // 3. Abschicken!
    return this.http.post<any>(url, body, { params }).pipe(
      map(json => {
        console.log('📬 [TeamRepo] Server-Antwort für Zuweisung erhalten:', json);
        return new ProjectMember(
          UserModel.fromJson(json.user || json),
          (json.projectRole as ProjectRole) || role
        );
      })
    );
  }

  /** 🗑️ Entfernt einen User aus einem Projekt */
  public deleteFromProject$(projectId: string, memberId: string): Observable<any> {
    // 1. Wir brauchen nur die projectId als Query-Parameter
    const params = new HttpParams()
      .set('projectId', projectId);

    // 2. Die memberId MUSS in den URL-Pfad, NICHT in die Query-Parameter
    // Und das "/remove" kommt weg!
    return this.http.delete<any>(`${teamApiUrl}/${memberId}`, { params });
  }

  /** 🪣 Synchronisiert die Offline-Liste eines Projekts */
  public bulkSyncForProject$(projectId: string, localList: ProjectMember[]): Observable<ProjectMember[]> {
    const params = new HttpParams().set('projectId', projectId);
    const body = { memberIds: localList.map(m => m.user.id) };

    return this.http.post<any[]>(`${teamApiUrl}/bulk`, body, { params }).pipe(
      map(jsonArray => jsonArray.map(json => new ProjectMember(
        UserModel.fromJson(json.user || json),
        (json.projectRole as ProjectRole) || 'DEVELOPER'
      )))
    );
  }

  /** 🌍 Holt alle registrierten Benutzer weltweit verpackt als ProjectMember (Standard-Rolle NONE) */
  public getAllGlobalUsers$(): Observable<ProjectMember[]> {
    console.log('📡 [TeamRepo] GET getAllGlobalUsers$ (globaler Pool) über:', teamApiUrl);

    // 🎯 Fix: Wir gehen über teamApiUrl (/api/teams) statt userApiUrl
    return this.http.get<any[]>(teamApiUrl).pipe(
      map(jsonArray => jsonArray.map(json => {
        // 🎯 Fix: Wir mappen das Ergebnis sauber in das ProjectMember-Modell
        return new ProjectMember(
          UserModel.fromJson(json.user || json),
          (json.projectRole as ProjectRole) || 'NONE' // Backend liefert hier 'NONE'
        );
      }))
    );
  }

  /** ☕ Ändert das Kaffeekonto auf dem Server über die korrekte teamApiUrl */
  public updateCoffeeAccount$(userId: string, balance: number, role: string, emoji: string): Observable<UserModel> {
    console.log(`📡 [TeamRepo] PUT updateCoffeeAccount$ für User ${userId} über teamApiUrl`);

    const params = new HttpParams()
      .set('balance', balance.toString())
      .set('role', role)
      .set('emoji', emoji);

    // 🎯 Fix: teamApiUrl (/api/teams) anstatt userApiUrl nutzen!
    return this.http.put<any>(`${teamApiUrl}/${userId}/coffee-account`, null, { params }).pipe(
      map(json => UserModel.fromJson(json))
    );
  }
}