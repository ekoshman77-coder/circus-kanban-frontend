import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UniversalTagInputComponent } from '../../../core/shared/components/universal-tag-input-component/universal-tag-input-component';
import { NoteService } from '../../../core/services/note-service';
import { NOTE_COLORS, NOTE_COLOR_PALETTE } from '../../../core/shared/constants/colors';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { TodoService } from '../../../core/services/todo/todo-service';
import { AiSuggestionService } from '../../../core/services/ai-suggestion-service';
import { WeatherService } from '../../../core/services/weather-service';

/**
 * Komponente für die Eingabe neuer Notizen/Ideen.
 * Unterstützt automatische KI-Vorschläge zur Umwandlung in Todos und Wetter-Integration.
 */
@Component({
  selector: 'app-note-input',
  standalone: true,
  imports: [FormsModule, UniversalTagInputComponent, ReactiveFormsModule],
  templateUrl: './note-input-component.html',
  styleUrl: './note-input-component.css'
})
export class NoteInputComponent {
  private noteService = inject(NoteService);
  private todoService = inject(TodoService);
  private aiSuggestionService = inject(AiSuggestionService);
  private weatherService = inject(WeatherService);

  /** Signal für den Titel der neuen Idee */
  public newTitle = signal<string>('');
  /** Signal für den Inhalt der neuen Idee */
  public newContent = signal<string>('');
  /** Signal für den Kategorietag der neuen Idee */
  public newTag = signal<string>('');
  /** Signal zur Steuerung der Anzeige des "In-Task-verwandeln" Buttons */
  public showTodoSuggestion = signal<boolean>(false);

  /** Event-Emitter: Signalisiert, dass die Idee in ein Todo umgewandelt werden soll */
  @Output() convertToTodoRequested = new EventEmitter<{ title: string; content: string; category: string }>();

  /** Formulargruppe für die strukturierte Erfassung der Notizdaten */
  public noteForm = new FormGroup({
    title: new FormControl(''),
    content: new FormControl(''),
    category: new FormControl(''),
    colorType: new FormControl(NOTE_COLORS.YELLOW)
  });

  /** Verfügbare Farbpalette für die Notizkarten */
  public colorPalette = NOTE_COLOR_PALETTE;

  /**
   * Konstruktor initialisiert die reaktive Logik zur Überwachung von Formularänderungen.
   * Debounced die Eingabe, um KI-Vorschläge erst bei einer kurzen Pause anzuzeigen.
   */
  constructor() {
    this.noteForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => this.isFormValueEqual(prev, curr))
    ).subscribe(values => {
      // Zeigt den KI-Button erst an, wenn der Titel aussagekräftig genug ist
      if (values.title && values.title.length > 3) {
        this.showTodoSuggestion.set(true);
      } else {
        this.showTodoSuggestion.set(false);
      }
    });
  }

  /**
   * Wandelt die aktuelle Idee in ein Todo um und triggert das entsprechende Event für die Elternkomponente.
   */
  public convertIdeaToTodo(): void {
    const values = this.noteForm.value;
    this.convertToTodoRequested.emit({
      title: values.title || '',
      content: values.content || '',
      category: values.category || ''
    });
  }

  /**
   * Speichert die Notiz im NoteService.
   * Holt zusätzlich aktuelle Wetterdaten (Location) und fügt diese der Notiz hinzu.
   */
  public async saveNote(): Promise<void> {
    const formValues = this.noteForm.value;
    let temperature: number | undefined = undefined;
    let weatherCode: number | undefined = undefined;

    try {
      const weatherData = await firstValueFrom(this.weatherService.getWEatherCurrentLocation());
      
      if (weatherData && weatherData.current_weather) {
        temperature = weatherData.current_weather.temperature;
        weatherCode = weatherData.current_weather.weathercode;
      }
    } catch (error) {
      console.warn('Wetter konnte nicht geladen werden, Notiz wird ohne Wetter gespeichert:', error);
    }
    
    this.noteService.addNote({
      title: formValues.title || '',
      content: formValues.content || '',
      tag: formValues.category || '',
      colorType: formValues.colorType || NOTE_COLORS.YELLOW,
      temperature: temperature,
      weatherCode: weatherCode
    });

    this.noteService.clearDraft();
    this.noteForm.reset({ colorType: NOTE_COLORS.YELLOW });
  }

  /**
   * Interne Hilfsmethode: Vergleicht Formularwerte, um unnötige Events zu verhindern.
   * @param prev Vorheriger Zustand.
   * @param curr Aktueller Zustand.
   * @returns boolean ob Werte identisch sind.
   */
  private isFormValueEqual(prev: any, curr: any): boolean {
    if (!prev || !curr) return false;
    return prev.title === curr.title &&
      prev.content === curr.content &&
      prev.category === curr.category &&
      prev.colorType === curr.colorType;
  }

  /**
   * Aktualisiert den Tag-State, wenn sich der Tag im Universal-Tag-Input ändert.
   * @param neuerTag Der neue Tag-Wert.
   */
  public onTagChanged(neuerTag: any): void {
    this.newTag.set(String(neuerTag || ''));
    this.noteForm.patchValue({ category: String(neuerTag || '') });
  }
}