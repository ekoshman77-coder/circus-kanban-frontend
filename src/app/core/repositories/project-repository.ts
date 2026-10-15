import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { projectApiUrl } from './links';
import { IProjectJSON } from './dto/project-json';
import { ProjectDashboardStatsDTO } from './dto/project-dashboard-stats-dto';

@Injectable({
  providedIn: 'root'
})
export class ProjectRepository {
  private http = inject(HttpClient);

  // 🔍 Alle Projekte eines Users holen: GET /api/projects?userId=...
  public getAllProjects(): Observable<IProjectJSON[]> {
    console.log("ProjectRepository: GET projects");

    return this.http.get<IProjectJSON[]>(projectApiUrl);
  }

  // 🔍 Einzelnes Projekt per ID holen: GET /api/projects/{id}
  public getProjectById(id: string): Observable<IProjectJSON> {
    return this.http.get<IProjectJSON>(`${projectApiUrl}/${id}`);
  }

  // ➕ Projekt erstellen: POST /api/projects
  public createProject(projectJson: IProjectJSON): Observable<IProjectJSON> {
    console.log("ProjectRepository createProject", projectJson);
    return this.http.post<IProjectJSON>(projectApiUrl, projectJson);
  }

  // ✏️ Projekt updaten (inkl. Meilensteine): PUT /api/projects/{id}
  public updateProject(projectJson: IProjectJSON): Observable<IProjectJSON> {
    return this.http.put<IProjectJSON>(`${projectApiUrl}/${projectJson.id}`, projectJson);
  }

  // 🗑️ Projekt löschen: DELETE /api/projects/{id}
  public deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${projectApiUrl}/${id}`);
  }

  // 🔄 BULK SYNC: Schickt alle lokalen Projekte zum Abgleich ans Backend
  public syncLocalProjects(userId: string, localProjects: IProjectJSON[]): Observable<IProjectJSON[]> {
    return this.http.post<IProjectJSON[]>(`${projectApiUrl}/sync`, { userId, projects: localProjects });
  }

  // 🌟 DASHBOARD STATS
  public getDashboardStatistics(userId: string): Observable<ProjectDashboardStatsDTO> {
    return this.http.get<ProjectDashboardStatsDTO>(`${projectApiUrl}/statistics/${userId}`);
  }

  /**
 * 👑 Lädt alle aktiven Firmenprojekte für den Admin
 */
public getAllProjectsForAdmin(): Observable<IProjectJSON[]> {
  return this.http.get<IProjectJSON[]>(`${projectApiUrl}/admin/all`);
}

/**
 * 👑 Lädt alle gezippten/gelöschten Projekte für den Admin-Papierkorb
 */
public getZipProjectsForAdmin(): Observable<IProjectJSON[]> {
  return this.http.get<IProjectJSON[]>(`${projectApiUrl}/admin/zipped`);
}

/**
 * 👑 Verschiebt ein Projekt in den Zip-Status (Löschen) oder stellt es wieder her
 */
public setProjectZipStatusForAdmin(projectId: string, isZipped: boolean): Observable<IProjectJSON> {
  return this.http.patch<IProjectJSON>(
    `${projectApiUrl}/admin/${projectId}/zip?isZipped=${isZipped}`,
    {}
  );
}
}