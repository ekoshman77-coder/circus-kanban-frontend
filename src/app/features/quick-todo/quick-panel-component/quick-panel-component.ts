import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export enum QuickPanelMode {
    ACTIVE,
    PAUSE 
}

@Component({
  selector: 'app-quick-panel-component',
  imports: [CommonModule],
  template: `
    <div class="quick-panel" [class.pause-theme]="currentModus === QuickPanelMode.PAUSE">
      <div class="panel-header">
        <span class="indicator-dot"></span>
        <h4>Verfügbare Quick-Vorlagen</h4>
      </div>
      
      <div class="template-grid">
        @if (currentModus === QuickPanelMode.ACTIVE) {
          @for (name of activeTodoList; track name) {
            <button class="task-template-btn" (click)="selectedTodo(name)">
              <span class="btn-text">{{ name }}</span>
              <span class="plus-icon">+</span>
            </button>
          }
        } 
        @else if (currentModus === QuickPanelMode.PAUSE) {
          @for (name of pauseTodoList; track name) {
            <button class="task-template-btn" (click)="selectedTodo(name)">
              <span class="btn-text">{{ name }}</span>
              <span class="plus-icon">+</span>
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .quick-panel {
      background: linear-gradient(135deg, #f8fafc, #f1f5f9);
      border: 1px solid #e2e8f0;
      padding: 18px;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    /* Wenn der Pausenmodus aktiv ist, färben wir das Panel dezent um */
    .quick-panel.pause-theme {
      background: linear-gradient(135deg, #fff7ed, #ffedd5);
      border-color: #fed7aa;
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .indicator-dot {
      width: 8px;
      height: 8px;
      background: #6366f1;
      border-radius: 50%;
    }
    .pause-theme .indicator-dot {
      background: #f97316;
    }

    .panel-header h4 {
      margin: 0;
      font-size: 13px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .pause-theme .panel-header h4 {
      color: #ea580c;
    }

    /* TEMPLATE BUTTON GRID */
    .template-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .task-template-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      color: #334155;
      text-align: left;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }

    .plus-icon {
      font-size: 16px;
      color: #94a3b8;
      transition: transform 0.2s ease;
    }

    /* Hover-Effekte je nach Modus */
    .task-template-btn:hover {
      border-color: #6366f1;
      background: #f5f3ff;
      transform: translateX(4px);
    }
    .pause-theme .task-template-btn:hover {
      border-color: #f97316;
      background: #fff7ed;
    }

    .task-template-btn:hover .plus-icon {
      color: #6366f1;
      transform: scale(1.2);
    }
    .pause-theme .task-template-btn:hover .plus-icon {
      color: #f97316;
    }
  `]})


export class QuickPanelComponent {
    @Input() currentModus: QuickPanelMode = QuickPanelMode.PAUSE;

    @Output() todoSelected = new EventEmitter<string>()

    pauseTodoList: string[] = [
      "🚀 Kaffee kochen", 
      "🧘 Kurze Pause machen",
      "🎵 Lieblingssong hören",
      "🍏 Snack-Pause & Trinken",
      "🚶 5 Min. Beine vertreten",
      "🌱 Frische Luft schnappen"
    ];

    activeTodoList: string[] = [
       "🐛 Bug fixen",
       "📝 Code aufräumen",
       "📧 E-Mails & Chat checken",
       "🧹 Board & Desktop aufräumen",
       "🗣️ Mit Kollegen abstimmen",
       "💡 Neue Idee aufschreiben"
    ];

    protected readonly QuickPanelMode = QuickPanelMode

    private toastMessage: string = ""

    selectedTodo(task: string) {
       this.todoSelected.emit(task)
     }

}
