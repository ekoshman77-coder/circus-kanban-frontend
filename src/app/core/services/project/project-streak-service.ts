import { inject, Injectable } from "@angular/core";
import { StreakRepository } from "../../repositories/streak-repository";
import { catchError, map, Observable, of } from "rxjs";
import { ProjectStreakInfoDto } from "../../repositories/dto/project-streak-info-dto";
import { ProjectStreakInfo } from "../../models/project-streak-info";

@Injectable({
  providedIn: 'root'
})
export class ProjectStreakService {
    private streakRepository = inject(StreakRepository)

    public getProjectStreakInfo(projectId: string): Observable<ProjectStreakInfo | null> {
        return this.streakRepository.getProjectStreakInfo(projectId).pipe(
            map(value => (value)? ProjectStreakInfo.fromJson(value) : null),
            catchError(error => {
                console.error('Fehler beim Laden der Projekt-Streaks:', error);
                return of(null)
            })
        )
    }
}
