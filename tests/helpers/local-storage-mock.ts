import { vi } from 'vitest';

/**
 * Erstellt einen voll funktionsfähigen In-Memory Mock für den localStorage.
 * Verhindert 'TypeError: localStorage.clear is not a function' in Node/Vitest-Umgebungen.
 */
export function setupLocalStorageMock(): void {
  const store: Record<string, string> = {};
  
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { 
      for (const key in store) {
        delete store[key]; 
      }
    })
  });
}