import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Note } from '../../../core/models/note';
import { NoteViewModel } from '../../../core/viewmodel/note-view-model';
import { WeatherIconPipe } from '../../../core/shared/pipes/weather-icon-pipe';
import { UserService } from '../../../core/services/user/user-service';

/**
 * Komponente zur Darstellung einer einzelnen Notizkarte (Post-It) auf der Pinnwand.
 * Verwaltet das reaktive Inline-Editing, schreibgeschützte Ansichten für Fremdnutzer
 * und stellt erweiterte UI-Zustände wie das Detail-Popup über ein dediziertes ViewModel dar.
 */
@Component({
  selector: 'app-note-component',
  standalone: true,
  imports: [CommonModule, FormsModule, WeatherIconPipe],
  templateUrl: './note-component.html',
  styleUrl: './note-component.css',
})
export class NoteComponent {
  /** 
   * Das langlebige UI-ViewModel für diese Notiz.
   * Steuert visuelle Zustände wie Edit-Modus, Popup-Anzeige und die zufällige Magnetfarbe.
   */
  @Input({ required: true }) vm!: NoteViewModel;

  /** 
   * Event-Emitter, der nach erfolgreicher Bearbeitung das aktualisierte Note-Modell 
   * nach oben funkt, um die Änderungen persistent in der PostgreSQL-Datenbank zu speichern.
   */
  @Output() updated = new EventEmitter<Note>();

  /** Service zur Ermittlung von Benutzerdaten und Rechten */
  private userService = inject(UserService);

  /** 
   * Ein abgeleitetes (computed) Signal, das stets die aktuell eingeloggte User-ID bereithält.
   * Wird für den Live-Abgleich der Editier-Rechte im Template genutzt.
   */
  public currentUserId = computed(() => this.userService.getCurrentUserId());

  /**
   * Beendet den Edit-Modus im ViewModel und triggert das Datenbank-Update 
   * für die übergeordnete Pinnwand.
   */
  public saveEdit(): void {
    this.vm.closeEdit();
    this.updated.emit(this.vm.note);
  }

  /**
   * Abfangjäger für Tastatureingaben innerhalb des Edit-Modus.
   * Drückt der User einfaches 'Enter', wird die Notiz sofort gespeichert.
   * Die Kombination 'Shift + Enter' wird durchgelassen, um normale Zeilenumbrüche im Textfeld zu erlauben.
   * 
   * @param event Das native Tastatur-Event aus dem DOM.
   */
  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.saveEdit();
    }
  }
}