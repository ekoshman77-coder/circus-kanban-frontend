import { TestBed } from '@angular/core/testing';
import { AiSuggestionService } from './ai-suggestion-service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('AiSuggestionService', () => {
  let service: AiSuggestionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiSuggestionService]
    });
    service = TestBed.inject(AiSuggestionService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('shouldSuggestTodo (To-Do-Vorschläge)', () => {
    it('sollte TRUE zurückgeben, wenn der Text ein Keyword enthält und die Struktur passt', () => {
      // "schreib" ist in der Keyword-Liste, 2 Wörter, > 5 Zeichen
      expect(service.shouldSuggestTodo('Email schreib')).toBe(true);
      expect(service.shouldSuggestTodo('Code refactor für UI')).toBe(true);
    });

    it('sollte FALSE zurückgeben, wenn ein Keyword enthalten ist, aber die Struktur zu kurz ist', () => {
      // Nur 1 Wort, obwohl Keyword enthalten ist
      expect(service.shouldSuggestTodo('schreib')).toBe(false);
      // Zu wenige Zeichen
      expect(service.shouldSuggestTodo('fix')).toBe(false);
    });

    it('sollte FALSE zurückgeben, wenn die Struktur passt, aber kein Keyword vorkommt', () => {
      // Genug Wörter und Zeichen, aber kein Keyword vorhanden
      expect(service.shouldSuggestTodo('Heute ist ein schöner Tag im Büro')).toBe(false);
    });

    it('sollte Groß- und Kleinschreibung bei Keywords ignorieren (Case-Insensitive)', () => {
      expect(service.shouldSuggestTodo('MEET MIT KUNDEN')).toBe(true);
      expect(service.shouldSuggestTodo('dokumentation Erstell')).toBe(true);
    });
  });

  describe('shouldSuggestMilestone (Meilenstein-Vorschläge)', () => {
    it('sollte TRUE zurückgeben, wenn der Text lang genug ist und ein Meilenstein-Wort enthält', () => {
      // "Release" enthalten, 5 Wörter, über 15 Zeichen
      const text = 'Wir planen das nächste große Release im Juni';
      expect(service.shouldSuggestMilestone(text)).toBe(true);
    });

    it('sollte FALSE zurückgeben, wenn das Wort enthalten ist, aber der Text die strenge Struktur nicht erfüllt', () => {
      // "Release" vorhanden, aber nur 2 Wörter (Soll-Wert für Meilensteine ist mind. 4 Wörter, 15 Zeichen)
      expect(service.shouldSuggestMilestone('Release jetzt')).toBe(false);
    });

    it('sollte FALSE zurückgeben, wenn der Text lang genug ist, aber kein Meilenstein-Wort enthält', () => {
      const text = 'Das ist ein extrem langer Text ohne ein wichtiges Schlüsselwort für Meilensteine';
      expect(service.shouldSuggestMilestone(text)).toBe(false);
    });
  });
});