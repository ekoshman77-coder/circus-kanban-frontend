import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Note } from '../../../core/models/note';
import { NoteViewModel } from '../../../core/viewmodel/note-view-model';

@Component({
  selector: 'app-note-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './note-component.html',
  styleUrl: './note-component.css',
})
export class NoteComponent {
  // 📥 Das schlaue, langlebige ViewModel kommt von der Pinnwand rein
  @Input({ required: true }) vm!: NoteViewModel;

  // 📢 Event nach oben für die PostgreSQL-Datenbank
  @Output() updated = new EventEmitter<Note>();

  public saveEdit(): void {
    // 1. Dem ViewModel sagen, dass der Edit-Modus vorbei ist
    this.vm.closeEdit();
    // 2. Das veränderte Note-Objekt an das Board funken für das Backend
    this.updated.emit(this.vm.note);
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.saveEdit();
    }
  }
}