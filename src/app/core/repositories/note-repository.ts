import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Note } from '../models/note';
import { noteApiUrl } from './links';

@Injectable({
  providedIn: 'root'
})
export class NoteRepository {
  private http = inject(HttpClient);
  // Passe die URL an dein Docker-Setup an (z.B. Port 8080 oder über ein Gateway)


  // 🔍 GET /api/notes?userId=...
  getNotesByUserId(userId: string): Observable<Note[]> {
    const params = new HttpParams().set('userId', userId);
    return this.http.get<Note[]>(noteApiUrl, { params });
  }

  // ➕ POST /api/notes
  createNote(note: Note): Observable<Note> {
    return this.http.post<Note>(noteApiUrl, note);
  }

  // ✏️ PUT /api/notes/{id}
  updateNote(id: string, note: Note): Observable<Note> {
       console.log("NoteRepository :: UpdateNote", note)
        console.log("NoteRepository :: UpdateNoteId", id)

    return this.http.put<Note>(`${noteApiUrl}/${id}`, note);
  }

  // 🗑️ DELETE /api/notes/{id}
  deleteNote(id: string): Observable<void> {
    console.log("NoteRepository:: DeleteNote")

    return this.http.delete<void>(`${noteApiUrl}/${id}`);
  }

  // get note by id
  getNoteById(id: string): Observable<Note> {
    return this.http.get<Note>(`${noteApiUrl}/${id}`)
  }
}