import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UniversalTagInputComponent } from '../../../core/shared/components/universal-tag-input-component/universal-tag-input-component';
import { NoteService } from '../../../core/services/note-service';
import { NOTE_COLORS, NOTE_COLOR_PALETTE } from '../../../core/shared/constants/colors';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { TodoService } from '../../../core/services/todo/todo-service';
import { AiSuggestionService } from '../../../core/services/ai-suggestion-service';

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

  public newTitle = signal<string>('');
  public newContent = signal<string>('');
  public newTag = signal<string>('');
  public showTodoSuggestion = signal<boolean>(false);

  // 🌟 Der Standardwert ist jetzt der String 'note-yellow'
  public newColor = signal<string>(NOTE_COLORS.YELLOW);

  // Die Palette für das Dropdown
  public colorPalette = NOTE_COLOR_PALETTE;

  public noteContent = signal<string>('');

  public noteForm = new FormGroup({
    title: new FormControl(''),
    content: new FormControl(''),
    colorType: new FormControl(NOTE_COLORS.YELLOW),
    category: new FormControl('')
  });

  constructor() {
    this.noteForm.valueChanges.pipe(
      distinctUntilChanged((prev, curr) => this.isFormValueEqual(prev, curr)),
      debounceTime(5000)
    ).subscribe(formValues => {
      // 🏁 Deine reaktive Pipe ruft einfach elegant den Service auf!
      this.noteService.saveDraft(formValues);
      console.log('📝 Entwurf via NoteService im LocalStorage gesichert!');
    });

    // 🕵️‍♂️ Smartes Lauschen auf den Titel für die To-Do-Erkennung!
    this.noteForm.get('title')?.valueChanges.subscribe(title => {
      if (!title) {
        this.showTodoSuggestion.set(false);
        return;
      }
      this.showTodoSuggestion.set(this.aiSuggestionService.shouldSuggestTodo(title));
    });
  }

  // 🚀 Die Funktion, die aufgerufen wird, wenn der User den "Ja, als Task anlegen"-Button drückt!
  public convertIdeaToTodo(): void {
    const formValues = this.noteForm.value;

    // 🎯 Wir bereiten das exakte Objekt vor, das deine Methode erwartet:
    this.todoService.createAndAddTodo({
      task: formValues.title || '',
      description: formValues.content || null,
      effort: 1,                 // Standard-Aufwand
      dueDate: Date.now(),       // Heute als Timestamp
      category: formValues.category || 'Idee',
      isStarted: false
    });

    // 🧼 Nach dem Speichern machen wir die KI-Box zu und leeren das Formular
    this.showTodoSuggestion.set(false);
    this.noteForm.reset({ colorType: NOTE_COLORS.YELLOW });

    alert('🎉 Perfekt! Die Idee wurde direkt in ein echtes To-Do verwandelt!');
  }


  public onTagChanged(tag: string): void {
    this.noteForm.patchValue({
      category: tag
    });
  }

  public saveNote(): void {
    const formValues = this.noteForm.value; // Holt die aktuellen Werte aus der Form

    this.noteService.addNote({
      title: formValues.title || '',
      content: formValues.content || '',
      tag: formValues.category || '',
      colorType: formValues.colorType || NOTE_COLORS.YELLOW
    });

    this.noteService.clearDraft();

    this.noteForm.reset({ colorType: NOTE_COLORS.YELLOW });
  }

  private isFormValueEqual(prev: any, curr: any): boolean {
    if (!prev || !curr) return false;
    return prev.title === curr.title &&
      prev.content === curr.content &&
      prev.category === curr.category &&
      prev.colorType === curr.colorType;
  }
}