import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { StreakInfoDto } from "../models/streak.info-dto";
import { Observable } from "rxjs";
import { streakUrl } from "./links";

@Injectable({
  providedIn: 'root',
})
export class StreakRepository {
  private http = inject(HttpClient);

   public syncAndGetStreakInfo(userId: string): Observable<StreakInfoDto> {
      return this.http.get<StreakInfoDto>(`${streakUrl}/${userId}`);
    }
  
}