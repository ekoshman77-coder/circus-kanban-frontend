import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { StatMode } from '../statistic-board-component/statistic-board-component';

@Component({
  selector: 'app-todo-overview',
  standalone: true,
  imports: [CommonModule, PercentPipe],
  template: `
    <div class="stats-overview-wrapper">
      
      <div class="chart-controls">
        <button class="rotate-btn" (click)="toggleRotation()">
          {{ isHorizontal() ? '📊 Vertikale Säulen' : '横 Horizontale Balken' }}
        </button>
      </div>

      <div class="chart-container" [class.horizontal-layout]="isHorizontal()">
        
        <div class="chart-bar-wrapper all">
          <div class="bar-label">📋 Gesamt</div>
          <div class="bar-track">
            <div class="bar-fill" [style.width]="getBarWidth('total')" [style.height]="getBarHeight('total')">
              <span class="bar-value">{{ getDisplayValue('total') }}{{ unit }}</span>
            </div>
          </div>
        </div>

        <div class="chart-bar-wrapper open">
          <div class="bar-label">⏳ Offen</div>
          <div class="bar-track">
            <div class="bar-fill" [style.width]="getBarWidth('open')" [style.height]="getBarHeight('open')">
              <span class="bar-value">{{ getDisplayValue('open') }}{{ unit }}</span>
            </div>
          </div>
        </div>

        <div class="chart-bar-wrapper overdue">
          <div class="bar-label">🚨 Überfällig</div>
          <div class="bar-track">
            <div class="bar-fill" [style.width]="getBarWidth('overdue')" [style.height]="getBarHeight('overdue')">
              <span class="bar-value">{{ getDisplayValue('overdue') }}{{ unit }}</span>
            </div>
          </div>
        </div>

        <div class="chart-bar-wrapper completed">
          <div class="bar-label">✅ Erledigt</div>
          <div class="bar-track">
            <div class="bar-fill" [style.width]="getBarWidth('completed')" [style.height]="getBarHeight('completed')">
              <span class="bar-value">{{ getDisplayValue('completed') }}{{ unit }}</span>
            </div>
          </div>
        </div>

      </div>

      <div class="details-accordion">
        <div class="accordion-summary">
          <span>🎯 Gesamtfortschritt im aktuellen Scope</span>
          <strong>{{ calculatedPercent | percent:'1.0-0' }}</strong>
        </div>
      </div>

    </div>
  `,
  styleUrl: './todo-overview-component.css'
})
export class TodoOverviewComponent {
  @Input({ required: true }) mode: StatMode = 'tasks';
  @Input({ required: true }) totalCount: number = 0;
  @Input({ required: true }) openTodos: any[] = [];
  @Input({ required: true }) completedTodos: any[] = [];
  @Input({ required: true }) overdueTodos: any[] = [];

  // Steuerung für das Drehen des Diagramms (Säulen vs Balken)
  protected isHorizontal = signal<boolean>(false);

  protected toggleRotation(): void {
    this.isHorizontal.update(v => !v);
  }

  // Einheit für die Anzeige
  protected get unit(): string {
    return this.mode === 'tasks' ? '' : ' P';
  }

  // --- REAKTIVE UND FEHLERFREIE SUMMIERUNG ---
  private sumEffort(todos: any[]): number {
    return todos.reduce((sum, t) => {
      // Wenn die Aufgabe erledigt ist und wir tatsächliche Punkte eingetragen haben, nehmen wir diese.
      // Ansonsten nehmen wir den geschätzten Aufwand (effort).
      const points = (t.done && t.usedEffort !== undefined && t.usedEffort !== null) 
        ? t.usedEffort 
        : (t.effort || 0);
      return sum + points;
    }, 0);
  }

  protected getDisplayValue(type: 'total' | 'open' | 'overdue' | 'completed'): number {
    if (this.mode === 'tasks') {
      switch (type) {
        case 'total': return this.totalCount;
        case 'open': return this.openTodos.length;
        case 'overdue': return this.overdueTodos.length;
        case 'completed': return this.completedTodos.length;
      }
    } else {
      switch (type) {
        case 'total': return this.sumEffort(this.openTodos) + this.sumEffort(this.completedTodos);
        case 'open': return this.sumEffort(this.openTodos);
        case 'overdue': return this.sumEffort(this.overdueTodos);
        case 'completed': return this.sumEffort(this.completedTodos);
      }
    }
  }

  protected get calculatedPercent(): number {
    const total = this.getDisplayValue('total');
    if (total === 0) return 0;
    return this.getDisplayValue('completed') / total;
  }

  // --- DYNAMISCHE ANIMATIONS-STYLES (BERECHNUNG IN PROZENT) ---
  private getPercentage(type: 'total' | 'open' | 'overdue' | 'completed'): number {
    const max = this.getDisplayValue('total');
    if (max === 0) return 0;
    return (this.getDisplayValue(type) / max) * 100;
  }

  protected getBarWidth(type: 'total' | 'open' | 'overdue' | 'completed'): string {
    return this.isHorizontal() ? `${this.getPercentage(type)}%` : '100%';
  }

  protected getBarHeight(type: 'total' | 'open' | 'overdue' | 'completed'): string {
    return this.isHorizontal() ? '100%' : `${this.getPercentage(type)}%`;
  }
}