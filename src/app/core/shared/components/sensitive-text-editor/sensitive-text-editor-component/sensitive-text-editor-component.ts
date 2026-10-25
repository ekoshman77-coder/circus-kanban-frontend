import { Component, input, output, signal, effect, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensitiveMatch } from '../../../../models/sensitive-match';
import { CreatePatternFromSelectionDto } from '../../../../repositories/dto/create-pattern-from-selection';
import { FormsModule } from '@angular/forms';
import { MasterDataService } from '../../../../services/admin/master-data-service';
import { SanitizationService } from '../../../../services/ai/sanitization/sanitization-service';
import { UniversalTagInputComponent } from '../../universal-tag-input-component/universal-tag-input-component';
import { UniversalPredictorService } from '../../../../services/ai/universal-predictor-service';
import { UserService } from '../../../../services/user/user-service';
import { NotificationService } from '../../../../services/notification/notification-service';
import { CreatePattern } from '../../../../models/create-pattern';

// Struktur für die einzelnen Text-Häppchen im Viewer
export interface TextSegment {
  text: string;
  textType: 'normal' | 'unknown' | 'approved' | 'unapproved';
  matchId?: string;
}

@Component({
  selector: 'app-sensitive-text-editor-component',
  standalone: true,
  imports: [CommonModule, FormsModule, UniversalTagInputComponent],
  templateUrl: './sensitive-text-editor-component.html',
  styleUrl: './sensitive-text-editor-component.css'
})
export class SensitiveTextEditorComponent {
  public text = input<string>('');
  public matches = input<SensitiveMatch[]>([]);
  public masterDataService = inject(MasterDataService);
  private predictorService = inject(UniversalPredictorService);
  public sanitizationService = inject(SanitizationService)
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  
  public editFinished = output<Map<string, boolean | null>>();
  public cancelled = output<void>();

  public feedbackMap = signal<Map<string, boolean | null>>(new Map());
  public patternTypes = this.masterDataService.patternTypes;
  public textMap = signal<TextSegment[]>([]);
  public isSaving = signal<boolean>(false);
  
  // Lern-Modus Zustände
  public isLearningModeActive = signal<boolean>(false);
  public selectedTextForPattern = signal<string>('');
  public selectedPatternType = signal<'EXACT' | 'KEYWORD_VALUE_BEFORE' | 'KEYWORD_VALUE_AFTER'>('KEYWORD_VALUE_BEFORE');
  public patternReason = signal<string>('SENSITIVE_DATA');

  // 📋 Liste aller bekannten Reasons aus der Datenbank für das Frontend
  public availableReasons = signal<string[]>([]);

  public patternCreated = output<CreatePatternFromSelectionDto>();

  constructor() {
    effect(() => {
      const currentText = this.text();
      const currentMatches = this.matches();

      if (currentText && currentText.length > 0) {
        this.parseTextWithMatches();
      } else {
        this.textMap.set([]);
      }
    });
  }

  public parseTextWithMatches(): void {
    const fullText = this.text();
    const rawMatches = this.matches() || [];
    const feedback = this.feedbackMap();

    if (!rawMatches || rawMatches.length === 0) {
      this.textMap.set([{ text: fullText, textType: 'normal' }]);
      return;
    }

    const sortedMatches = [...rawMatches].sort((a, b) => a.startIndex - b.startIndex);
    const segments: TextSegment[] = [];
    let currentIndex = 0;

    for (const match of sortedMatches) {
      if (match.startIndex > currentIndex) {
        segments.push({
          text: fullText.substring(currentIndex, match.startIndex),
          textType: 'normal'
        });
      }

      const currentStatus = feedback.has(match.id) 
        ? feedback.get(match.id) 
        : match.isApproved;

      let textType: 'unknown' | 'approved' | 'unapproved' = 'unknown';
      if (currentStatus === true) {
        textType = 'approved';
      } else if (currentStatus === false) {
        textType = 'unapproved';
      } else {
        textType = 'unknown';
      }

      segments.push({
        text: fullText.substring(match.startIndex, match.endIndex),
        textType: textType,
        matchId: match.id
      });

      currentIndex = Math.max(currentIndex, match.endIndex);
    }

    if (currentIndex < fullText.length) {
      segments.push({
        text: fullText.substring(currentIndex),
        textType: 'normal'
      });
    }

    this.textMap.set(segments);
  }

  public onSegmentClick(segment: TextSegment): void {
    if (segment.textType === 'normal' || !segment.matchId) return;

    const currentMap = new Map(this.feedbackMap());
    const matchId = segment.matchId;
    const currentStatus = currentMap.get(matchId);

    let nextStatus: boolean | null = true;
    if (currentStatus === true) {
      nextStatus = false;
    } else if (currentStatus === false) {
      nextStatus = null;
    } else {
      nextStatus = true;
    }

    currentMap.set(matchId, nextStatus);
    this.feedbackMap.set(currentMap);
    this.parseTextWithMatches();
  }

  public saveChanges(): void {
    this.editFinished.emit(this.feedbackMap());
  }

  public cancel(): void {
    this.cancelled.emit();
  }

  public toggleLearningMode(): void {
    const newState = !this.isLearningModeActive();
    this.isLearningModeActive.set(newState);
    this.selectedTextForPattern.set('');

    // Wenn der Lernmodus aktiviert wird, laden wir direkt die bekannten Reasons vom Backend!
    if (newState) {
      this.loadExistingReasons();
    }
  }

private loadExistingReasons(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.predictorService.getAvailableCategories(userId, 'sanitization', []).then(reasons => {
      this.availableReasons.set(reasons);
    }).catch(err => {
      console.error('Fehler beim Laden der Reasons:', err);
    });
  }

  // Wird aufgerufen, wenn der Admin Text markiert
  public onTextMouseUp(): void {
    if (!this.isLearningModeActive()) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedString = selection.toString()?.trim();
    if (!selectedString || selectedString.length < 2) return;

    const fullText = this.text();
    
    // 🎯 Exakte Start-Position direkt über die DOM-Range des Browsers ermitteln!
    let selStart = -1;
    let selEnd = -1;

    try {
      const range = selection.getRangeAt(0);
      const container = document.querySelector('.text-viewer-box');
      
      if (container && container.contains(range.commonAncestorContainer)) {
        // Wir erstellen eine Hilfs-Range vom Anfang des Containers bis zum Start der Auswahl
        const preRange = range.cloneRange();
        preRange.selectNodeContents(container);
        preRange.setEnd(range.startContainer, range.startOffset);
        
        // Die Länge dieser Vor-Range ist exakt der Start-Index im Gesamttext!
        selStart = preRange.toString().length;
        selEnd = selStart + selectedString.length;
      } else {
        // Fallback falls der Container mal nicht greift
        selStart = fullText.indexOf(selectedString);
        selEnd = selStart + selectedString.length;
      }
    } catch (e) {
      selStart = fullText.indexOf(selectedString);
      selEnd = selStart + selectedString.length;
    }

    if (selStart === -1) return;

    // 🎯 Auf Überschneidungen mit bereits existierenden Matches prüfen
    const existingMatches = this.matches() || [];
    const hasOverlap = existingMatches.some(match => {
      return selStart < match.endIndex && selEnd > match.startIndex;
    });

    if (hasOverlap) {
      console.warn('⚠️ Markierung überschneidet sich mit einem bereits vorhandenen Match!');
      
      // Auswahl im Browser direkt aufheben
      selection.removeAllRanges();
      this.selectedTextForPattern.set('');
      
      // 🚀 Jetzt greift die Notification garantiert!
      this.notificationService.showNotification(
        'Die Markierung überschneidet sich mit einem bereits erkannten sensiblen Bereich.',
        'error'
      );
      return;
    }

    // Wenn alles sauber ist: Muster-Konstruktion starten
    this.selectedTextForPattern.set(selectedString);
    this.fetchReasonPrediction(selectedString, this.selectedPatternType());
  }

  private fetchReasonPrediction(text: string, type: string): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    // Wir nutzen hier unseren UniversalPredictorService und übergeben den patternType!
    this.predictorService.predict(text, userId, 'sanitization', type).then(prediction => {
      if (prediction) {
        this.patternReason.set(prediction);
      }
    }).catch(err => {
      console.error('Fehler bei Reason-Vorhersage:', err);
    });
  }

  public onPatternTypeChange(newType: string): void {
    this.selectedPatternType.set(newType as any);

    const currentText = this.selectedTextForPattern();
    if (currentText) {
      // Bei Typ-Wechsel direkt neue Vorhersage beim Backend holen
      this.fetchReasonPrediction(currentText, newType);
    }
  }
  
public submitNewPattern(): void {
    const text = this.selectedTextForPattern();
    if (!text || text.trim().length === 0) return;

    const dto: CreatePattern = {
      selectedText: text,
      patternType: this.selectedPatternType(),
      reason: this.patternReason() || 'SENSITIVE_DATA'
    };

    this.isSaving.set(true);

    // 🚀 Über die Queue einreihen (unterstützt Offline-Modus & Labor-Sandbox!)
    this.sanitizationService.createPattern(
      text, 
      this.selectedPatternType(), 
      this.patternReason() || 'SENSITIVE_DATA'
    );

    // Erfolgreich eingereiht -> UI-Zustand direkt aufräumen
    this.selectedTextForPattern.set('');
    this.patternReason.set('');
    this.isLearningModeActive.set(false);
    this.isSaving.set(false);

    // Notification ausgeben
    this.notificationService.showNotification(
      'Muster erfolgreich zur Erstellung in die Warteschlange eingereiht.',
      'success'
    );

    // Event für das übergeordnete Board emittieren
    this.patternCreated.emit(dto);
  }
}