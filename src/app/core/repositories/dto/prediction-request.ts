export interface PredictionRequest {
  text: string;        // Der eingetippte Text (z.B. Titel)
  contextType: string; // "todo" oder "note"
  userId: string;      // Wer fragt gerade?
}