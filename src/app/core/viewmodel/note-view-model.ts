import { signal } from '@angular/core';
import { Note } from '../models/note';

export class NoteViewModel {
  // 📦 Das eigentliche Datenmodell (wird direkt im Konstruktor gesetzt)
  public note: Note;

  // 🎨 UI-Zustände als reaktive Signals
  public isEditing = signal<boolean>(false);
  public showPopup = signal<boolean>(false);
  public pinClass = signal<string>('');

  private pinColors = ['pin-red', 'pin-green', 'pin-blue', 'pin-yellow'];

  constructor(note: Note) {
    this.note = note;
    console.log("noteViewModel:", note)
    // Pin-Farbe einmalig beim Erstellen der Instanz festlegen
    const randomIndex = Math.floor(Math.random() * this.pinColors.length);
    this.pinClass.set(this.pinColors[randomIndex]);
  }

  // ⚙️ UI-Aktionen (MVVM-Logik)
  public startEdit(): void {
    this.isEditing.set(true);
    this.showPopup.set(false);
  }

  public togglePopup(): void {
    this.showPopup.update(v => !v);
  }

  public closeEdit(): void {
    this.isEditing.set(false);
  }

  public canEnterCalculator(): boolean {
    // Das Board fragt nur – das ViewModel entscheidet anhand der Daten!
    return !this.note.isInCalculation;
  }
}