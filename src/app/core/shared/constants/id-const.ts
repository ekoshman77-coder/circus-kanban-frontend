// Die globale Konstante für das Erkennungsmerkmal
export const LOCAL_ID_PREFIX = 'local-';

/**
 * Generiert eine absolut sichere, eindeutige Dummy-ID fürs Frontend
 */
export function generateLocalId(): string {
  return `${LOCAL_ID_PREFIX}${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Prüft global für JEDES Objekt, ob es eine temporäre Frontend-ID hat
 */
export function isLocalId(id: string | null | undefined): boolean {
  if (!id) return true; // Keine ID bedeutet automatisch: Es ist neu!
  return id.startsWith(LOCAL_ID_PREFIX);
}