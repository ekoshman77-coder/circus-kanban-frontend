import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerComponent } from '../planner-component/planner-component';
import { PlannerSettingsComponent } from '../planner-settings-component/planner-settings-component'; // Passe den Pfad zu deinen Einstellungen an

@Component({
  selector: 'app-planner-board',
  standalone: true,
  imports: [CommonModule, PlannerComponent, PlannerSettingsComponent],
  template: `
    <div class="board-wrapper">
      
      <div class="board-header">
        <div class="brand-zone">
          <h2 class="board-title">Smart Planner Dashboard</h2>
        </div>
        
        <div class="nav-actions">
          <button 
            [class.active]="activeTab() === 'matrix'" 
            (click)="activeTab.set('matrix')" 
            class="nav-btn matrix-btn-style">
            📊 Prioritäten-Matrix
          </button>
          <button 
            [class.active]="activeTab() === 'settings'" 
            (click)="activeTab.set('settings')" 
            class="nav-btn settings-btn-style">
            ⚙️ Tages-Setup
          </button>
        </div>
      </div>

      <div class="tab-content">
        @if (activeTab() === 'matrix') {
          <app-planner></app-planner>
        } @else {
          <app-planner-settings></app-planner-settings>
        }
      </div>

    </div>
  `,
  styles: [`
    .board-wrapper {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    /* Header-Layout: Titel links, Buttons rechts */
    .board-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 16px;
    }
    
    .board-title {
      font-size: 26px;
      font-weight: 800;
      margin: 0;
      background: linear-gradient(135deg, #1e3a8a, #3b82f6); /* Sattes, professionelles Blau */
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    /* Button-Container rechts */
    .nav-actions {
      display: flex;
      gap: 12px;
    }
    
    /* Basis-Style für die neuen breiten Buttons */
    .nav-btn {
      border: 1px solid #bfdbfe;
      background: #ffffff;
      color: #2563eb; /* Schönes Azure-Blau */
      padding: 10px 24px; /* Schön breit */
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.04);
      min-width: 160px; /* Garantiert die Breite */
      text-align: center;
    }
    
    .nav-btn:hover {
      background: #f0fdf4; /* Minimaler Touch ins Frische beim Hovern */
      border-color: #3b82f6;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(37, 99, 235, 0.08);
    }
    
    /* 🔥 DER AKTIVE ZUSTAND: Wunderschönes sattes Blau/Indigo */
    .nav-btn.active {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }
    
    .nav-btn.active:hover {
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      transform: none;
    }

    /* Sanfte Einblend-Animation beim Tab-Wechsel */
    .tab-content {
      animation: fadeIn 0.2s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* 📱 RESPONSIVE: Auf Handys zentrieren wir alles untereinander */
    @media (max-width: 768px) {
      .board-header {
        flex-direction: column;
        align-items: center;
        gap: 16px;
        text-align: center;
      }
      .nav-actions {
        width: 100%;
        flex-direction: column;
      }
      .nav-btn {
        width: 100%;
      }
    }
  `]
})
export class PlannerBoardComponent {
  activeTab = signal<'matrix' | 'settings'>('matrix');
}
