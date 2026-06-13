import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user/user-service';

@Component({
  selector: 'app-planner-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="settings-card">
      <h3 class="settings-title">⚙️ Tages-Konfiguration</h3>
      <p class="settings-subtitle">Stelle hier deine aktuelle Tagesform und dein biologisches Profil ein.</p>

      <div class="setting-group">
        <label class="group-label">Wie ist deine Energie gerade?</label>
        <div class="energy-buttons">
          <button 
            [class.active]="userService.userEnergy() === 'low'" 
            (click)="userService.userEnergy.set('low')" 
            class="energy-btn low">🥱 Schläfrig / Müde</button>
          <button 
            [class.active]="userService.userEnergy() === 'normal'" 
            (click)="userService.userEnergy.set('normal')" 
            class="energy-btn normal">😐 Normal</button>
          <button 
            [class.active]="userService.userEnergy() === 'high'" 
            (click)="userService.userEnergy.set('high')" 
            class="energy-btn high">⚡ Klarer Kopf / Fokus</button>
        </div>
      </div>

      <div class="setting-group">
        <label class="group-label">Wie lange planst du HEUTE noch zu arbeiten?</label>
        <div class="time-slider-container">
          <input 
            type="range" min="1" max="12" step="any"
            [value]="sliderWorkingTimeLeft()" 
            (input)="onWorkingTimeLeftInput($event)"
            (change)="onWorkingTimeLeftChange()" 
            class="time-slider"
          >
          <span class="time-display">⏳ <strong>{{ displayWorkingTimeLeft() }} Std.</strong></span>
        </div>
      </div>

      <hr class="settings-divider">

      <h4 class="profile-title">🧠 Dein biologischer Rhythmus & Standards</h4>
      <p class="profile-subtitle">Diese Werte gelten als Standard für jeden neuen Tag.</p>

      <div class="setting-group">
        <label class="group-label">Deine regelmäßige tägliche Arbeitszeit (Standard):</label>
        <div class="time-slider-container">
          <input 
            type="range" min="1" max="12" step="any"
            [value]="sliderWorkingHours()" 
            (input)="onWorkingHoursInput($event)"
            (change)="onWorkingHoursChange()"
            class="time-slider prime-accent"
          >
          <span class="time-display">💼 <strong>{{ displayWorkingHours() }} Stunden</strong></span>
        </div>
      </div>

      <div class="setting-group">
        <label class="group-label">Beginn deiner mentalen Prime-Time:</label>
        <div class="time-slider-container">
          <input 
            type="range" min="0" max="23" step="any"
            [value]="sliderPrimeStart()" 
            (input)= "onPrimeStartInput($event)"
            (change)="onPrimeTimeStartChange()"
            class="time-slider prime-accent"
          >
          <span class="time-display">🔔 <strong>Ab {{ displayPrimeStart() }}:00 Uhr</strong></span>
        </div>
      </div>

      <div class="setting-group">
        <label class="group-label">Ende deines Konzentrations-Fensters:</label>
        <div class="time-slider-container">
          <input 
            type="range" min="0" max="23" step="any"
            [value]="sliderPrimeEnd()" 
            (input)="onLocalPrimeEndInput($event)"
            (change)="onPrimeTimeEndChange()"
            class="time-slider prime-accent"
          >
          <span class="time-display">🔕 <strong>Bis {{ displayPrimeEnd() }}:00 Uhr</strong></span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-card { background: #b4fdd638; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .settings-title { margin: 0 0 6px 0; font-size: 18px; color: #1e293b; }
    .settings-subtitle { color: #64748b; font-size: 13px; margin: 0 0 24px 0; }
    .setting-group { margin-bottom: 24px; }
    .group-label { display: block; font-weight: 600; font-size: 14px; color: #334155; margin-bottom: 10px; }
    .energy-buttons { display: flex; gap: 10px; }
    .energy-btn { flex: 1; padding: 12px; border: 1px solid #cbd5e1; background: white; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 13px; }
    .energy-btn:hover { background: #f8fafc; }
    .energy-btn.active.low { background: #fef3c7; color: #d97706; border-color: #f59e0b; }
    .energy-btn.active.normal { background: #e0f2fe; color: #0369a1; border-color: #38bdf8; }
    .energy-btn.active.high { background: #f3e8ff; color: #7e22ce; border-color: #a855f7; }
    .time-slider-container { display: flex; align-items: center; gap: 16px; }
    .time-slider { flex-grow: 1; accent-color: #0ea5e9; cursor: pointer; }
    .time-slider.prime-accent { accent-color: #7c3aed; }
    .time-display { font-size: 14px; color: #1e293b; white-space: nowrap; background: #f1f5f9; padding: 6px 12px; border-radius: 6px; min-width: 110px; text-align: center; }
    .settings-divider { border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0; }
    .profile-title { margin: 0 0 4px 0; color: #1e293b; font-size: 16px; }
    .profile-subtitle { color: #64748b; font-size: 12px; margin: 0 0 20px 0; }
  `]
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