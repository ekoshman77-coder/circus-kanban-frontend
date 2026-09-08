import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { departmentApiUrl } from './links';
import { IDepartment } from './dto/deparment-json';

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
  public create$(name: string, specialisation?: string): Observable<IDepartment> {
    const payload: IDepartment = {
      name: name,
      specialization: specialisation
    }
    return this.http.post<IDepartment>(departmentApiUrl,  payload);
  }

  // 📝 Abteilung umbenennen
  public update$(id: string, name: string, specialisation?: string): Observable<IDepartment> {
    const payload: IDepartment = {
      id: id,
      name: name,
      specialization: specialisation
    }
    return this.http.put<IDepartment>(`${departmentApiUrl}/${id}`, payload );
  }

  // 🗑️ Abteilung löschen
  public delete$(id: string): Observable<void> {
    return this.http.delete<void>(`${departmentApiUrl}/${id}`);
  }
}