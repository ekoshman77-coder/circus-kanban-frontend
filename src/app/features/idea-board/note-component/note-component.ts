import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Note } from '../../../core/models/note';
import { NoteViewModel } from '../../../core/viewmodel/note-view-model';
import { WeatherIconPipe } from '../../../core/shared/pipes/weather-icon-pipe';

@Component({
  selector: 'app-note-component',
  imports: [CommonModule, FormsModule, WeatherIconPipe],
  templateUrl: './note-component.html',
  styleUrl: './note-component.css',
})
export class NoteComponent {
  // Das schlaue, langlebige ViewModel kommt von der Pinnwand rein
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

  // 🌤️ Unsere neue Wetter-Übersetzung für die WMO-Codes von Open-Meteo
  public getWeatherIcon(code: number | undefined): string {
    if (code === undefined) return '☁️';
    
    if (code === 0) return '☀️'; // Klarer Himmel
    if (code >= 1 && code <= 3) return '🌤️'; // Leicht bewölkt
    if (code >= 45 && code <= 48) return '🌫️'; // Nebel
    if (code >= 51 && code <= 67) return '🌧️'; // Regen
    if (code >= 71 && code <= 77) return '❄️'; // Schnee
    if (code >= 80 && code <= 82) return '🌦️'; // Regenschauer
    if (code >= 95 && code <= 99) return '⛈️'; // Gewitter
    
    return '☁️';
  }
}