import { Component, computed, inject } from '@angular/core';
import { AppStateService } from '../../../core/services/app-state/app-state-service';

@Component({
  selector: 'app-labor-switch-component',
  imports: [],
  templateUrl: './labor-switch-component.html',
  styleUrl: './labor-switch-component.css',
})
export class LaborSwitchComponent {
  private appStateService = inject(AppStateService);

  // 1. Signale/Properties sauber für das HTML vorbereiten
  public isLaborMode = this.appStateService.isLaborMode;
  public isLaborForced = this.appStateService.isLaborForced;

  public tooltipText = computed(() => 
    this.isLaborMode() 
      ? 'Labor-Modus (Sandbox) AKTIV - Klick zum Deaktivieren' 
      : 'Labor-Modus aktivieren'
  );

  // 2. Action-Methode für das Template
  public toggleLaborMode(): void {
    this.appStateService.toggleLaborMode();
  }
}