import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { departmentApiUrl } from './links';

export interface IDepartment {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class DepartmentRepository {
  private http = inject(HttpClient);

  // 📋 Alle Abteilungen holen
  public getAll$(): Observable<IDepartment[]> {
    return this.http.get<IDepartment[]>(departmentApiUrl);
  }

  // ✨ Neue Abteilung erstellen
  public create$(name: string): Observable<IDepartment> {
    return this.http.post<IDepartment>(departmentApiUrl, { name });
  }

  // 📝 Abteilung umbenennen
  public update$(id: string, name: string): Observable<IDepartment> {
    return this.http.put<IDepartment>(`${departmentApiUrl}/${id}`, { name });
  }

  // 🗑️ Abteilung löschen
  public delete$(id: string): Observable<void> {
    return this.http.delete<void>(`${departmentApiUrl}/${id}`);
  }
}