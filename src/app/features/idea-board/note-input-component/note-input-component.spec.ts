import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoteInputComponent } from './note-input-component';
import { NoteService } from '../../../core/services/note/note-service';
import { TodoService } from '../../../core/services/todo/todo-service';
import { WeatherService } from '../../../core/services/weather/weather-service';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NOTE_COLORS } from '../../../core/shared/constants/colors';

describe('NoteInputComponent', () => {
  let component: NoteInputComponent;
  let fixture: ComponentFixture<NoteInputComponent>;

  const mockNoteService = {
    addNote: vi.fn(),
    clearDraft: vi.fn()
  };

  const mockWeatherService = {
    getWeatherCurrentLocation: vi.fn().mockReturnValue(of({
      current_weather: { temperature: 22.5, weathercode: 0 }
    }))
  };

  beforeEach(async () => {
    vi.useFakeTimers(); // ⏱️ Vitest kontrolliert ab jetzt die Zeitflüsse!

    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    });

    await TestBed.configureTestingModule({
      imports: [NoteInputComponent, ReactiveFormsModule],
      providers: [
        { provide: NoteService, useValue: mockNoteService },
        { provide: TodoService, useValue: {} },
        { provide: WeatherService, useValue: mockWeatherService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NoteInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers(); // Zeit nach jedem Test wieder normal laufen lassen
  });

  it('sollte die Eingabe-Komponente erfolgreich erstellen', () => {
    expect(component).toBeTruthy();
  });

  // 🤖 TEST-REIHE 1: KI-VORSCHLAG-LOGIK (DEBOUNCE)
  describe('🤖 KI-Task-Vorschlag (RxJS Debounce)', () => {
    it('sollte den Vorschlag NICHT anzeigen, wenn der Titel zu kurz ist', () => {
      component.noteForm.patchValue({ title: 'Hi' });
      
      vi.advanceTimersByTime(500); // ⏱️ 500ms vorspulen mittels Vitest
      fixture.detectChanges();

      expect(component.showTodoSuggestion()).toBe(false);
    });

    it('sollte den Vorschlag erst nach 500ms anzeigen, wenn der Titel lang genug ist', () => {
      component.noteForm.patchValue({ title: 'Das ist eine tolle Idee' });
      
      expect(component.showTodoSuggestion()).toBe(false);

      vi.advanceTimersByTime(500); // ⏱️ Und ab in die Zukunft!
      fixture.detectChanges();

      expect(component.showTodoSuggestion()).toBe(true);
    });
  });

  // 🌤️ TEST-REIHE 2: SPEICHERN & WETTER-INTEGRATION
  describe('🌤️ Notiz speichern & Wetter abrufen', () => {
    it('sollte beim Speichern die aktuellen Wetterdaten anhängen und das Formular resetten', async () => {
      component.noteForm.patchValue({
        title: 'Wetter-Test-Notiz',
        content: 'Es regnet oder die Sonne scheint',
        category: 'Natur',
        colorType: NOTE_COLORS.YELLOW
      });

      // Wir warten darauf, dass das async/await-Wetter-Promise sich auflöst
      await component.saveNote();

      expect(mockNoteService.addNote).toHaveBeenCalledWith({
        title: 'Wetter-Test-Notiz',
        content: 'Es regnet oder die Sonne scheint',
        tag: 'Natur',
        colorType: NOTE_COLORS.YELLOW,
        temperature: 22.5,
        weatherCode: 0
      });

      expect(mockNoteService.clearDraft).toHaveBeenCalled();
      expect(component.noteForm.get('colorType')?.value).toBe(NOTE_COLORS.YELLOW);
    });

    it('sollte die Notiz auch dann speichern, wenn der Wetter-Service fehlschlägt', async () => {
      mockWeatherService.getWeatherCurrentLocation.mockReturnValueOnce(throwError(() => new Error('API Down')));

      component.noteForm.patchValue({
        title: 'Fehler-Test-Notiz',
        colorType: NOTE_COLORS.YELLOW
      });

      await component.saveNote();

      expect(mockNoteService.addNote).toHaveBeenCalledWith({
        title: 'Fehler-Test-Notiz',
        content: '',
        tag: '',
        colorType: NOTE_COLORS.YELLOW,
        temperature: undefined,
        weatherCode: undefined
      });
    });
  });
});