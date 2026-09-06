import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { departmentApiUrl } from './links';

export interface IDepartment {
  id?: string;
  name: string;
  scope: string;
  specialization?: string;
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
  public create$(name: string, scope: string, specialisation?: string): Observable<IDepartment> {
    const payload: IDepartment = {
      name: name,
      scope: scope,
      specialization: specialisation
    }
    return this.http.post<IDepartment>(departmentApiUrl,  payload);
  }

  // 📝 Abteilung umbenennen
  public update$(id: string, name: string, scope: string, specialisation?: string): Observable<IDepartment> {
    const payload: IDepartment = {
      id: id,
      name: name,
      scope: scope,
      specialization: specialisation
    }
    return this.http.put<IDepartment>(`${departmentApiUrl}/${id}`, payload );
  }

  // 🗑️ Abteilung löschen
  public delete$(id: string): Observable<void> {
    return this.http.delete<void>(`${departmentApiUrl}/${id}`);
  }
}