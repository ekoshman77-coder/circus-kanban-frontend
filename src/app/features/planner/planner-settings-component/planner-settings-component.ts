import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user/user-service';
import { UserSettingsDataManager } from '../../../core/services/user/user-settings-data-manager';

@Component({
  selector: 'app-planner-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planner-settings-component.html',
  styleUrl: './planner-settings-component.css'
  })
export class PlannerSettingsComponent {
  public userSettingsDataManager = inject(UserSettingsDataManager);

  // 1️⃣ REINE SLIDER SIGNALE (Erlauben unendliche Fließkommazahlen für 100% flüssige Maus-Bewegung)
  sliderWorkingTimeLeft = signal<number>(this.userSettingsDataManager.workingTimeLeft());
  sliderWorkingHours = signal<number>(this.userSettingsDataManager.workingHours());
  sliderPrimeStart = signal<number>(this.userSettingsDataManager.primeTimeStartHour());
  sliderPrimeEnd = signal<number>(this.userSettingsDataManager.primeTimeEndHour());

  // 2️⃣ DISKRETE ANZEIGE-SIGNALE (Springen stur erst um, wenn eine neue Ganzzahl erreicht ist)
  displayWorkingTimeLeft = signal<number>(this.userSettingsDataManager.workingTimeLeft());
  displayWorkingHours = signal<number>(this.userSettingsDataManager.workingHours());
  displayPrimeStart = signal<number>(this.userSettingsDataManager.primeTimeStartHour());
  displayPrimeEnd = signal<number>(this.userSettingsDataManager.primeTimeEndHour());

  constructor() {
    // Wenn Daten initial geladen werden, setzen wir beide Signal-Welten gleich
    effect(() => {
      const hours = this.userSettingsDataManager.workingHours();
      const start = this.userSettingsDataManager.primeTimeStartHour();
      const end = this.userSettingsDataManager.primeTimeEndHour();
      const left = this.userSettingsDataManager.workingTimeLeft();

      this.sliderWorkingHours.set(hours);
      this.displayWorkingHours.set(hours);

      this.sliderPrimeStart.set(start);
      this.displayPrimeStart.set(start);

      this.sliderPrimeEnd.set(end);
      this.displayPrimeEnd.set(end);

      this.sliderWorkingTimeLeft.set(left);
      this.displayWorkingTimeLeft.set(left);
    }, { allowSignalWrites: true });
  }

  // 🏃‍♂️ INPUT-EVENTS: Überschreiben die Slider-Werte absolut pixelgenau und flüssig!
  onWorkingTimeLeftInput(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderWorkingTimeLeft.set(val); // Für die flüssige Maus
    this.displayWorkingTimeLeft.set(Math.floor(val)); // Für die Textbox daneben
  }

  onWorkingHoursInput(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderWorkingHours.set(val);
    this.displayWorkingHours.set(Math.floor(val));
  }

  onPrimeStartInput(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderPrimeStart.set(val);
    this.displayPrimeStart.set(Math.floor(val));
  }

  onLocalPrimeEndInput(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderPrimeEnd.set(val);
    this.displayPrimeEnd.set(Math.floor(val));
  }

  // 💾 CHANGE-EVENTS (beim Loslassen): Schießen die saubere Ganzzahl in den Service
  onWorkingTimeLeftChange() {
    this.userSettingsDataManager.changeWorkingTimeLeft(this.displayWorkingTimeLeft());
  }

  onWorkingHoursChange() {
    this.userSettingsDataManager.changeDefaultWorkingHours(this.displayWorkingHours());
  }

  onPrimeTimeStartChange() {
    this.userSettingsDataManager.changePrimeTimeStart(this.displayPrimeStart());
  }

  onPrimeTimeEndChange() {
    this.userSettingsDataManager.changePrimeTimeEnd(this.displayPrimeEnd());
  }
}