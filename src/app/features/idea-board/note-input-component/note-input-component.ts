import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UniversalTagInputComponent } from '../../../core/shared/components/universal-tag-input-component/universal-tag-input-component';
import { NoteService } from '../../../core/services/note-service';
import { NOTE_COLORS, NOTE_COLOR_PALETTE } from '../../../core/shared/constants/colors';

@Component({
  selector: 'app-note-input',
  standalone: true,
  imports: [FormsModule, UniversalTagInputComponent],
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

  public onTagChanged(tag: string): void {
    this.newTag.set(tag);
  }

  public saveNote(): void {
    const title = this.newTitle().trim();
    const content = this.newContent().trim();
    const tag = this.newTag().trim();
    const color = this.newColor(); // Liefert z.B. 'note-yellow'

    if (!title || !content) return;

    // Ab in den Service damit
    this.noteService.addNote({ title, content, tag, colorType: color });

    // Reset auf Standard
    this.newTitle.set('');
    this.newContent.set('');
    this.newTag.set('');
    this.newColor.set(NOTE_COLORS.YELLOW); 
  }
}