import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, input, Input, OnChanges, OnInit, Output, signal, SimpleChanges } from '@angular/core';
import { TodoService } from '../../../core/services/todo/todo-service';
import { switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

export enum QuickPanelMode {
    ACTIVE,
    PAUSE 
}

@Component({
  selector: 'app-quick-panel-component',
  imports: [CommonModule],
  templateUrl: './quick-panel-component.html',
  styleUrl: './quick-panel-component.css'   
})
export class QuickPanelComponent implements OnInit, OnChanges {
    private todoService = inject(TodoService);
    protected readonly QuickPanelMode = QuickPanelMode;

    // Wir bleiben hier bei einem normalen @Input, damit das Zusammenspiel 
    // mit ngOnChanges im Lifecycle perfekt und ohne Verzögerung greift!
    @Input() currentModus: QuickPanelMode = QuickPanelMode.ACTIVE;
    @Output() todoSelected = new EventEmitter<string>();

    // 🎯 Genau wie du gesagt hast: Ein einfaches, sauberes Signal für die Vorlagen!
    public quickPredictions = signal<string[]>([]);
    public isLoading = signal<boolean>(false);

    // 🚀 Beim Start sofort laden!
    ngOnInit(): void {
      this.loadPredictions();
    }

    // 🔄 Bei jedem Wechsel des Modus (Arbeit/Pause) neu laden!
    ngOnChanges(changes: SimpleChanges): void {
      if (changes['currentModus'] && !changes['currentModus'].isFirstChange()) {
        this.loadPredictions();
      }
    }

    private loadPredictions(): void {
      this.isLoading.set(true);
      const stringModus = this.currentModus === QuickPanelMode.ACTIVE ? 'ACTIVE' : 'PAUSE';
      
      this.todoService.getQuickPredictions(stringModus).subscribe({
        next: (predictions) => {
          // 📥 Die Daten kommen an (aus DB oder Cache) -> Einfach ins Signal setzen!
          this.quickPredictions.set(predictions);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
    }

    selectedTodo(name: string) {
        this.todoSelected.emit(name);
    }
}