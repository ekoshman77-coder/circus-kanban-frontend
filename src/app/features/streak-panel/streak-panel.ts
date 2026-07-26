import { Component, Input, OnInit } from '@angular/core';
import { StreakInfoDto } from '../../core/models/streak.info-dto';

@Component({
  selector: 'app-streak-panel',
  imports: [],
  templateUrl: './streak-panel.html',
  styleUrl: './streak-panel.css',
})
export class StreakPanelComponent implements OnInit {
  @Input() streakData: StreakInfoDto | null = null;
  isOpen = false;

  ngOnInit(): void {}

  toggleDrawer(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * 🎨 DEINE GENIALE IDEE: Berechnet die Farbsättigung der Flamme basierend auf der Batterie!
   * Nutzt CSS-Filter, um die Flamme bei leerem Akku ergrauen zu lassen.
   */
  getFlameSaturation(): string {
    if (!this.streakData) return 'saturate(0) brightness(0.5)';
    
    const pct = this.streakData.batteryPercentage;
    
    if (this.streakData.isShieldActive) {
      // Wenn das Schutzschild aktiv ist, geben wir ihr einen bläulichen oder magischen Schein
      return 'hue-rotate(180deg) saturate(1.2)';
    }

    // Lineare Abschwächung: 100% Akku = volle Sättigung (1.5). 0% Akku = Grau (0.1)
    const saturation = 0.1 + (pct / 100) * 1.4;
    const brightness = 0.6 + (pct / 100) * 0.6; // Wird auch etwas dunkler bei Leerstand

    return `saturate(${saturation}) brightness(${brightness})`;
  }
}