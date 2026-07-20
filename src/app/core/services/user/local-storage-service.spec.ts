// local-storage-service.spec.ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageService } from './local-storage-service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    // Frisches localStorage-Mock für jeden Testlauf
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { })
    });

    TestBed.configureTestingModule({
      providers: [LocalStorageService]
    });

    service = TestBed.inject(LocalStorageService);
  });

  it('sollte ein Objekt als JSON-String speichern und wieder korrekt parsen', () => {
    const testKey = 'user_energy';
    const testValue = 'high';

    service.setItem(testKey, testValue);
    const geladen = service.getItem<string>(testKey);

    expect(localStorage.setItem).toHaveBeenCalledWith(testKey, JSON.stringify(testValue));
    expect(geladen).toBe('high');
  });

  it('sollte beim Ausfall von JSON.parse im Fehlerfall null zurückgeben', () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue('kein-gueltiges-json{]');
    
    const ergebnis = service.getItem('irgendein_key');
    
    expect(ergebnis).toBeNull();
  });

  it('sollte bei clearAllSessionData alle App-spezifischen Keys löschen', () => {
    service.clearAllSessionData();

    // Wir prüfen, ob removeItem für jeden der definierten Standard-Schlüssel aufgerufen wurde
    Object.values(LocalStorageService.KEYS).forEach(key => {
      expect(localStorage.removeItem).toHaveBeenCalledWith(key);
    });
  });
});