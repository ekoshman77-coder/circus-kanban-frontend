import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { CreatePatternFromSelectionDto } from "./dto/create-pattern-from-selection";
import { sanitizeApiUrl } from "./links";
import { PredictSanitizationReasonDto, ReasonPredictResponseDto } from "./dto/predict-sanitization-reason-dto";

@Injectable({
  providedIn: 'root',
})
export class SanitizationRepository {
  private http = inject(HttpClient);

   public createPattern(dto: CreatePatternFromSelectionDto): Observable<void> {
      return this.http.post<void>(`${sanitizeApiUrl}/pattern-from-selection`, dto);
    }
}