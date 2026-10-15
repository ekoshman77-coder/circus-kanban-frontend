import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { StreakInfoDto } from "../models/streak.info-dto";
import { Observable } from "rxjs";
import { streakUrl } from "./links";
import { ProjectStreakInfoDto } from "./dto/project-streak-info-dto";

@Injectable({
  providedIn: 'root',
})
export class StreakRepository {
  private http = inject(HttpClient);

   public syncAndGetStreakInfo(userId: string): Observable<StreakInfoDto> {
      return this.http.get<StreakInfoDto>(`${streakUrl}/${userId}`);
    }

    public getProjectStreakInfo(projectId: string): Observable<ProjectStreakInfoDto> {
      return this.http.get<ProjectStreakInfoDto>(`${streakUrl}/project/${projectId}`)
    }  
}