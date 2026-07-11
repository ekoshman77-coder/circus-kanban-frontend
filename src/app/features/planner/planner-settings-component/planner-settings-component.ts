import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user/user-service';

@Component({
  selector: 'app-planner-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planner-settings-component.html',
  styleUrl: './planner-settings-component.css'
  })
export class PlannerSettingsComponent {
  userService = inject(UserService);

  // 1️⃣ REINE SLIDER SIGNALE (Erlauben unendliche Fließkommazahlen für 100% flüssige Maus-Bewegung)
  sliderWorkingTimeLeft = signal<number>(this.userService.workingTimeLeft());
  sliderWorkingHours = signal<number>(this.userService.workingHours());
  sliderPrimeStart = signal<number>(this.userService.primeTimeStartHour());
  sliderPrimeEnd = signal<number>(this.userService.primeTimeEndHour());

  // 2️⃣ DISKRETE ANZEIGE-SIGNALE (Springen stur erst um, wenn eine neue Ganzzahl erreicht ist)
  displayWorkingTimeLeft = signal<number>(this.userService.workingTimeLeft());
  displayWorkingHours = signal<number>(this.userService.workingHours());
  displayPrimeStart = signal<number>(this.userService.primeTimeStartHour());
  displayPrimeEnd = signal<number>(this.userService.primeTimeEndHour());

  constructor() {
    // Wenn Daten initial geladen werden, setzen wir beide Signal-Welten gleich
    effect(() => {
      const hours = this.userService.workingHours();
      const start = this.userService.primeTimeStartHour();
      const end = this.userService.primeTimeEndHour();
      const left = this.userService.workingTimeLeft();

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
    this.userService.changeWorkingTimeLeft(this.displayWorkingTimeLeft());
  }

  onWorkingHoursChange() {
    this.userService.changeDefaultWorkingHours(this.displayWorkingHours());
  }

  onPrimeTimeStartChange() {
    this.userService.changePrimeTimeStart(this.displayPrimeStart());
  }

  onPrimeTimeEndChange() {
    this.userService.changePrimeTimeEnd(this.displayPrimeEnd());
  }
}