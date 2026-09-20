import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserSettingsDataManager } from '../../../core/services/user/user-settings-data-manager';
import { UserEnergyLevel } from '../../../core/models/user.settings';

@Component({
  selector: 'app-planner-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planner-settings-component.html',
  styleUrl: './planner-settings-component.css'
})
export class PlannerSettingsComponent {
  private userSettingsDataManager = inject(UserSettingsDataManager);

  // 1️⃣ LOKALE UI-SIGNALS (Komponente besitzt ihren eigenen State)
  public userEnergy = signal<UserEnergyLevel>('MEDIUM');

  // Slider-Signale (für flüssige 100fps Drag-Bewegung)
  public sliderWorkingTimeLeft = signal<number>(8);
  public sliderWorkingHours = signal<number>(8);
  public sliderPrimeStart = signal<number>(10);
  public sliderPrimeEnd = signal<number>(18);

  // Diskrete Anzeige-Signale (Ganzzahlen)
  public displayWorkingTimeLeft = signal<number>(8);
  public displayWorkingHours = signal<number>(8);
  public displayPrimeStart = signal<number>(10);
  public displayPrimeEnd = signal<number>(18);

  constructor() {
    // Synchronisiere den DataManager-State in die lokalen Komponentensignals
    effect(() => {
      const settings = this.userSettingsDataManager.settings();
      if (!settings) return;

      this.userEnergy.set(settings.userEnergy);

      this.sliderWorkingHours.set(settings.defaultWorkingHours);
      this.displayWorkingHours.set(settings.defaultWorkingHours);

      this.sliderPrimeStart.set(settings.primeTimeStartHour);
      this.displayPrimeStart.set(settings.primeTimeStartHour);

      this.sliderPrimeEnd.set(settings.primeTimeEndHour);
      this.displayPrimeEnd.set(settings.primeTimeEndHour);

      this.sliderWorkingTimeLeft.set(settings.workingTimeLeft);
      this.displayWorkingTimeLeft.set(settings.workingTimeLeft);
    }, { allowSignalWrites: true });
  }

  // ⚡ ENERGIE LEVEL ÄNDERN
  public onEnergyChange(level: UserEnergyLevel): void {
    this.userEnergy.set(level);
    this.userSettingsDataManager.setUserEnergy(level);
  }

  // 🏃‍♂️ INPUT-EVENTS (während des Slidens)
  public onWorkingTimeLeftInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderWorkingTimeLeft.set(val);
    this.displayWorkingTimeLeft.set(Math.floor(val));
  }

  public onWorkingHoursInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderWorkingHours.set(val);
    this.displayWorkingHours.set(Math.floor(val));
  }

  public onPrimeStartInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderPrimeStart.set(val);
    this.displayPrimeStart.set(Math.floor(val));
  }

  public onLocalPrimeEndInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.sliderPrimeEnd.set(val);
    this.displayPrimeEnd.set(Math.floor(val));
  }

  // 💾 CHANGE-EVENTS (beim Loslassen des Sliders -> ab in die Queue!)
  public onWorkingTimeLeftChange(): void {
    this.userSettingsDataManager.changeWorkingTimeLeft(this.displayWorkingTimeLeft());
  }

  public onWorkingHoursChange(): void {
    this.userSettingsDataManager.changeDefaultWorkingHours(this.displayWorkingHours());
  }

  public onPrimeTimeStartChange(): void {
    this.userSettingsDataManager.changePrimeTimeStart(this.displayPrimeStart());
  }

  public onPrimeTimeEndChange(): void {
    this.userSettingsDataManager.changePrimeTimeEnd(this.displayPrimeEnd());
  }
}