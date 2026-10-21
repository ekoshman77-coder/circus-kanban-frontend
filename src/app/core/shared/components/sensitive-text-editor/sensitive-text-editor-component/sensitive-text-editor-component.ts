import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensitiveMatch } from '../../../../models/sensitive-match';

// Struktur für ein sensibles Match vom Backend

// Struktur für die einzelnen Text-Häppchen im Viewer
export interface TextSegment {
  text: string;
  textType: 'normal' | 'unknown' | 'approved' | 'unapproved';
  matchId?: string;
}

@Component({
  selector: 'app-sensitive-text-editor-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sensitive-text-editor-component.html',
  styleUrl: './sensitive-text-editor-component.css'
})
export class SensitiveTextEditorComponent {
  // Inputs als moderne Angular Signals
  public text = input<string>('');
  public matches = input<SensitiveMatch[]>([]);

  // Outputs für das Eltern-Component (Modal)
  public editFinished = output<Map<string, boolean | null>>();
  public cancelled = output<void>();

  // Interne Feedback-Map: Speichert die Entscheidungen des Admins (matchId -> true/false/null)
  public feedbackMap = signal<Map<string, boolean | null>>(new Map());

  // Die fertige Liste an Segmenten für das HTML-Template
  public textMap = signal<TextSegment[]>([]);

  constructor() {
    effect(() => {
      // Reagiert automatisch, wenn sich text() oder matches() ändern
      const currentText = this.text();
      const currentMatches = this.matches();

      console.log('🔍 [Editor] Text empfangen:', currentText);
      console.log('🔍 [Editor] Matches empfangen:', currentMatches);

      if (currentText && currentText.length > 0) {
        this.parseTextWithMatches();
      } else {
        this.textMap.set([]);
      }
    });
  }

  /**
   * Zerteilt den Gesamttext anhand der Match-Indizes in Segmente (normal vs. sensibel)
   */
  public parseTextWithMatches(): void {
    const fullText = this.text();
    const rawMatches = this.matches() || [];
    const feedback = this.feedbackMap();

    if (!rawMatches || rawMatches.length === 0) {
      this.textMap.set([{ text: fullText, textType: 'normal' }]);
      return;
    }

    // Nach Startindex sortieren, damit die Reihenfolge stimmt
    const sortedMatches = [...rawMatches].sort((a, b) => a.startIndex - b.startIndex);
    const segments: TextSegment[] = [];
    let currentIndex = 0;

    for (const match of sortedMatches) {
      // 1. Normaler Text vor dem sensiblen Treffer
      if (match.startIndex > currentIndex) {
        segments.push({
          text: fullText.substring(currentIndex, match.startIndex),
          textType: 'normal'
        });
      }

      // 2. Status ermitteln (Priorität hat die lokale feedbackMap, sonst Backend-Wert)
      const currentStatus = feedback.has(match.id) 
        ? feedback.get(match.id) 
        : match.isApproved;

      let textType: 'unknown' | 'approved' | 'unapproved' = 'unknown';
      if (currentStatus === true) {
        textType = 'approved';     // Geschwärzt (schwarz)
      } else if (currentStatus === false) {
        textType = 'unapproved';   // Falschalarm (grün)
      } else {
        textType = 'unknown';      // Ungeprüft (rot/orange)
      }

      // 3. Das sensible Segment hinzufügen
      segments.push({
        text: fullText.substring(match.startIndex, match.endIndex),
        textType: textType,
        matchId: match.id
      });

      currentIndex = Math.max(currentIndex, match.endIndex);
    }

    // Restlicher normaler Text nach dem letzten Match
    if (currentIndex < fullText.length) {
      segments.push({
        text: fullText.substring(currentIndex),
        textType: 'normal'
      });
    }

    this.textMap.set(segments);
  }

  /**
   * Klick auf ein sensibles Segment schaltet den Status um:
   * Offen (unknown) -> Geschwärzt (approved) -> Falschalarm (unapproved) -> Offen
   */
  public onSegmentClick(segment: TextSegment): void {
    if (segment.textType === 'normal' || !segment.matchId) return;

    console.log('🖱️ Segment geklickt:', segment);

    const currentMap = new Map(this.feedbackMap());
    const matchId = segment.matchId;
    const currentStatus = currentMap.get(matchId);

    let nextStatus: boolean | null = true;
    if (currentStatus === true) {
      nextStatus = false;   // Zu Falschalarm wechseln
    } else if (currentStatus === false) {
      nextStatus = null;    // Zurück auf offen
    } else {
      nextStatus = true;    // Zu Geschwärzt wechseln
    }

    currentMap.set(matchId, nextStatus);
    this.feedbackMap.set(currentMap);

    // Neu parsen, damit sich die Ansicht sofort anpasst
    this.parseTextWithMatches();
  }

  public saveChanges(): void {
    this.editFinished.emit(this.feedbackMap());
  }

  public cancel(): void {
    this.cancelled.emit();
  }
}