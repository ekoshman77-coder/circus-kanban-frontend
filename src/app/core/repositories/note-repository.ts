import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Note } from '../models/note';
import { noteApiUrl } from './links';
import { INoteJson } from './dto/note-json';

@Injectable({
  providedIn: 'root'
})
export class NoteRepository {
  private http = inject(HttpClient);

  // 🔍 GET /api/notes?userId=... (Jetzt mit Klassen-Mapping!)
  getNotesByUserId(userId: string): Observable<Note[]> {
    let params = new HttpParams();
    params = new HttpParams().set('userId', userId);
    return this.http.get<INoteJson[]>(noteApiUrl, { params }).pipe(
      map(jsonArray => (jsonArray || []).map(json => this.mapToNoteClass(json)))
    );
  }

  // ➕ POST /api/notes
  createNote(note: Note): Observable<Note> {
    return this.http.post<INoteJson>(noteApiUrl, note).pipe(
      map(json => this.mapToNoteClass(json))
    );
  }

  // ✏️ PUT /api/notes/{id}
  updateNote(note: Note): Observable<Note> {
    const id = note.id!
    return this.http.put<INoteJson>(`${noteApiUrl}/${id}`, note).pipe(
      map(json => this.mapToNoteClass(json))
    );
  }

  promoteNote(id: string): Observable<Note> {
    return this.http.patch<INoteJson>(`${noteApiUrl}/${id}/promote`, {}).pipe(
      map(json => this.mapToNoteClass(json))
    );
  }

  revertNote(id: string): Observable<Note> {
    return this.http.patch<INoteJson>(`${noteApiUrl}/${id}/revert`, {}).pipe(
      map(json => this.mapToNoteClass(json))
    );
  }

  changeStatus(id: string, newStatus: boolean): Observable<Note> {
    const payload = {
      id: id,
      inCalculation: newStatus
    }
    return this.http.patch<INoteJson>(`${noteApiUrl}/status`, payload).pipe(
      map(json => this.mapToNoteClass(json))
    )
  }

  // 🗑️ DELETE /api/notes/{id}
deleteNote(id: string, userId: string): Observable<void> {
    let params = new HttpParams().set('userId', userId);
    return this.http.delete<void>(`${noteApiUrl}/${id}`, { params });
  }
  
  // 🔍 GET Einzelne Note
  getNoteById(id: string): Observable<Note> {
    return this.http.get<INoteJson>(`${noteApiUrl}/${id}`).pipe(
      map(json => this.mapToNoteClass(json))
    );
  }

  // 🧪 Hilfsmethode: Garantiert uns echte Klasseninstanzen mit Methoden
  private mapToNoteClass(json: INoteJson): Note {
    return new Note({
      id: json.id,
      userId: json.userId,
      departmentId: json.departmentId,
      title: json.title,
      content: json.content,
      colorType: json.colorType,
      tag: json.tag,
      isInCalculation: json.isInCalculation,
      temperature: json.temperature,
      weatherCode: json.weatherCode,
      scope: json.scope
    });
  }
}