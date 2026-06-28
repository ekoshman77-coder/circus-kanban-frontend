export interface UnifiedSuggestion {
  title: string;
  score?: number;      // Kommt von der KI (Online)
  duration?: number;   // Kommt vom Template (Offline)
  source: 'KI' | 'TEMPLATE';
  isRecommended: boolean;
  words: string[]
}