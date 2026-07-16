import { Injectable } from '@angular/core';

/**
 * Service zur intelligenten Analyse von Freitexten (z. B. aus Notizen oder Chat-Eingaben).
 * Prüft mithilfe von strukturellen Kriterien und Schlüsselwörtern, ob dem Benutzer
 * die Erstellung eines To-Dos oder eines Meilensteins vorgeschlagen werden soll.
 */
@Injectable({
  providedIn: 'root'
})
export class AiSuggestionService {
  
  /** Liste von handverlesenen Aktions-Schlüsselwörtern, die auf ein To-Do hinweisen */
  private readonly taskKeywords = [
    'schreib', 'anruf', 'fix', 'bau', 'vorbereit', 
    'kauf', 'erstell', 'prüf', 'meet', 'refactor', 'test'
  ];

  /**
   * Validiert die strukturelle Qualität des übergebenen Textes.
   * Verhindert Scheinvorschläge bei unvollständigen Sätzen oder einzelnen Buchstaben.
   * * @param text Der zu prüfende Text.
   * @param wordsAmount Die Mindestanzahl an Wörtern (Standard: 2).
   * @param lettersAmount Die Mindestgesamtlänge an Zeichen ohne Leerzeichen (Standard: 5).
   * @returns `true`, wenn der Text die strukturellen Kriterien erfüllt, andernfalls `false`.
   */
  private isValidTextStructure(
    text: string, 
    wordsAmount: number = 2, 
    lettersAmount: number = 5 
  ): boolean {
    if (!text || text.trim().length <= lettersAmount) return false;
    
    const words = text.trim().split(/\s+/).filter(wort => wort.length > 0);
    return words.length >= wordsAmount;
  }

  /**
   * Prüft, ob der eingegebene Text als To-Do vorgeschlagen werden sollte.
   * Nutzt standardmäßig eine weichere Strukturprüfung (mind. 2 Wörter, 5 Zeichen)
   * und gleicht den Text mit den To-Do-Schlüsselwörtern ab.
   * * @param text Der vom Nutzer eingegebene Text.
   * @returns `true`, wenn ein To-Do vorgeschlagen werden soll.
   */
  public shouldSuggestTodo(text: string): boolean {
    if (!this.isValidTextStructure(text)) return false;
    
    return this.taskKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * Prüft, ob der Text für einen Meilenstein geeignet ist.
   * Erfordert eine strengere Textstruktur (mind. 4 Wörter, 15 Zeichen)
   * und spezifische Projektmanagement-Begriffe wie "Release" oder "Phase".
   * * @param text Der vom Nutzer eingegebene Text.
   * @returns `true`, wenn ein Meilenstein vorgeschlagen werden soll.
   */
  public shouldSuggestMilestone(text: string): boolean {
    if (!this.isValidTextStructure(text, 4, 15)) return false;
    
    return text.toLowerCase().includes('release') || text.toLowerCase().includes('phase');
  }
}