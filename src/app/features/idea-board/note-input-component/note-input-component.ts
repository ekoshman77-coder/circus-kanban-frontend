import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UniversalTagInputComponent } from '../../../core/shared/components/universal-tag-input-component/universal-tag-input-component';
import { NoteService } from '../../../core/services/note-service';
import { NOTE_COLORS, NOTE_COLOR_PALETTE } from '../../../core/shared/constants/colors';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-note-input',
  standalone: true,
  imports: [FormsModule, UniversalTagInputComponent, ReactiveFormsModule],
  templateUrl: './note-input-component.html',
  styleUrl: './note-input-component.css'
})
export class NoteInputComponent {
  private noteService = inject(NoteService);

  public newTitle = signal<string>('');
  public newContent = signal<string>('');
  public newTag = signal<string>('');
  
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