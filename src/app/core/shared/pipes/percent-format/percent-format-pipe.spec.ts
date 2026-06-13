import { PercentFormatPipe } from './percent-format-pipe';

describe('PercentFormatPipe', () => {
  let pipe: PercentFormatPipe;

  // Vor jedem einzelnen Test erstellen wir die Pipe frisch
  beforeEach(() => {
    pipe = new PercentFormatPipe();
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  // Test 2: Standardverhalten ohne Parameter (Runden und Leerzeichen)
  it('sollte 33.333 zu "33 %" formatieren (Standardwerte)', () => {
    const result = pipe.transform(33.3333);
    expect(result).toBe('33 %');
  });

  // Test 3: Die berüchtigte JavaScript-Null-Falle!
  it('sollte die Zahl 0 korrekt als "0 %" ausgeben und nicht als leeren String', () => {
    const result = pipe.transform(0);
    expect(result).toBe('0 %');
  });

  // Test 4: Parameter für Nachkommastellen testen
  it('sollte Nachkommastellen anzeigen, wenn der Parameter digits gesetzt ist', () => {
    const result = pipe.transform(33.3333, 2);
    expect(result).toBe('33,33 %');
  });

  // Test 5: Parameter für das Leerzeichen testen
  it('sollte kein Leerzeichen anzeigen, wenn useSpace false ist', () => {
    const result = pipe.transform(50, 0, false);
    expect(result).toBe('50%');
  });

  // Test 6: Robustheit gegen fehlerhafte Eingaben (z.B. ein Text)
  it('sollte den Text unverändert zurückgeben, wenn keine Zahl übergeben wird', () => {
    const result = pipe.transform('keine-zahl');
    expect(result).toBe('keine-zahl');
  });
});
