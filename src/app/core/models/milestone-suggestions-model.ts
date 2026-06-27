import { MilestoneSuggestion } from "../repositories/ai-repository";
import { UnifiedSuggestion } from "./unified-suggestion";

export interface MilestoneSuggestionsModel {
  recommended: UnifiedSuggestion[];
  degraded: UnifiedSuggestion[];
}