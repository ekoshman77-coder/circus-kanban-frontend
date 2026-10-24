import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SanitizationRepository } from '../../../repositories/sanitization-repository';
import { PredictSanitizationReasonDto, ReasonPredictResponseDto } from '../../../repositories/dto/predict-sanitization-reason-dto';
import { CreatePatternFromSelectionDto } from '../../../repositories/dto/create-pattern-from-selection';
import { SanitizationDataManager } from './sanitization-data-manager';

@Injectable({
  providedIn: 'root'
})
export class SanitizationService {
  private sanitizationDataManager = inject(SanitizationDataManager);

  public createPattern(selectedText: string, patternType: string, reason: string) {
    this.sanitizationDataManager.queueCreatePattern(selectedText, patternType, reason);
  }
}