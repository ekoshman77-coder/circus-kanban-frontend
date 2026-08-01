import { Component, computed, Input, OnInit, effect, input } from '@angular/core';
import { StreakInfoDto } from '../../core/models/streak.info-dto';

@Component({
  selector: 'app-streak-panel',
  imports: [],
  templateUrl: './streak-panel.html',
  styleUrl: './streak-panel.css',
})
export class StreakPanelComponent implements OnInit {
  streakData = input<StreakInfoDto | null>(null);
  isOpen = false;

  constructor() {
    // 🕵️‍♂️ Automatische Überwachung: Schlägt im Terminal/Konsole an, wenn neue Daten reinkommen
    effect(() => {
      console.log('--- REINTRITT NEUER STREAK-DATEN ---');
      console.log('streakData aktuell:', this.streakData);
      console.log('Signal percentage() sagt:', this.percentage());
      console.log('Signal isShieldActive() sagt:', this.isShieldActive());
      console.log('Typ von percentage:', typeof this.percentage());
    });
  }

  ngOnInit(): void {}

  toggleDrawer(): void {
    this.isOpen = !this.isOpen;
  }

public percentage = computed(() => {
    const data = this.streakData();
    return data ? data.batteryPercentage : 0;
  });

public isShieldActive = computed(() => {
    const data = this.streakData();
    return data ? data.isShieldActive : false;
  });

public infoText = computed(() => {
    const data = this.streakData();
    return data ? data.infoText : "";
  });

  public streakDays = computed(() => {
    const data = this.streakData();
    return data ? data.streakDays : 0
  })
}