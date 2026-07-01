import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { projectApiUrl } from './links';
import { N } from '@angular/cdk/keycodes';

@Injectable({
  providedIn: 'root'
})
export class ProjectRepository {
  private http = inject(HttpClient);

  // 🔍 Alle Projekte eines Users holen: GET /api/projects?userId=...
  public getProjectsByUserId(userId: string | null): Observable<any[]> {
    let params = new HttpParams()
    if (userId) {
      params = new HttpParams().set('userId', userId);
    }
    return this.http.get<any[]>(projectApiUrl, { params });
  }

  // 🔍 2) Einzelnes Projekt per ID holen: GET /api/projects/{id}
  public getProjectById(id: string): Observable<any> {
    return this.http.get<any>(`${projectApiUrl}/${id}`);
  }

  // ➕ Projekt erstellen: POST /api/projects
  public createProject(projectDto: any): Observable<any> {
    return this.http.post<any>(projectApiUrl, projectDto);
  }

  // ✏️ Projekt updaten (inkl. Meilensteine): PUT /api/projects/{id}
  public updateProject(id: string, projectDto: any): Observable<any> {
    return this.http.put<any>(`${projectApiUrl}/${id}`, projectDto);
  }

  // 🗑️ Projekt löschen: DELETE /api/projects/{id}
  public deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${projectApiUrl}/${id}`);
  }

  // 🔄 BULK SYNC: Schickt alle lokalen Projekte zum Abgleich ans Backend
  public syncLocalProjects(userId: string, localProjects: any[]): Observable<any[]> {
    return this.http.post<any[]>(`${projectApiUrl}/sync`, { userId, projects: localProjects });
  }
}