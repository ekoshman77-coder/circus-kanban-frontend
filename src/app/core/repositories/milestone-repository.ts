import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Milestone } from '../models/milestone';
import { milestoneApiUrl } from './links';

@Injectable({
  providedIn: 'root'
})
export class MilestoneRepository {

  constructor(private http: HttpClient) {}

  getById(id: string): Observable<Milestone> {
    return this.http.get<Milestone>(`${milestoneApiUrl}/${id}`);
  }

  create(milestone: Milestone): Observable<Milestone> {
    return this.http.post<Milestone>(milestoneApiUrl, milestone);
  }

  update(id: string, milestone: Milestone): Observable<Milestone> {
    return this.http.put<Milestone>(`${milestoneApiUrl}/${id}`, milestone);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${milestoneApiUrl}/${id}`);
  }
}