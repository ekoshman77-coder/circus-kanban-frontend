import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AiSuggestionService {
  
  private readonly taskKeywords = [
    'schreib', 'anruf', 'fix', 'bau', 'vorbereit', 
    'kauf', 'erstell', 'prüf', 'meet', 'refactor', 'test'
  ];

  /**
   * 🏆 DEINE MEISTERLEISTUNG: Flexibel einstellbare Strukturprüfung!
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
   * Für To-Dos: Nutzt einfach die cleveren Standardwerte (2 Wörter, 5 Buchstaben)
   */
  public shouldSuggestTodo(text: string): boolean {
    if (!this.isValidTextStructure(text)) return false;
    
    return this.taskKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * 🔮 FÜR DIE ZUKUNFT: Für Meilensteine fordern wir jetzt strengere Kriterien!
   */
  public shouldSuggestMilestone(text: string): boolean {
    // Hier sagen wir explizit: Mindestens 4 Wörter und 15 Buchstaben!
    if (!this.isValidTextStructure(text, 4, 15)) return false;
    
    return text.toLowerCase().includes('release') || text.toLowerCase().includes('phase');
  }
}