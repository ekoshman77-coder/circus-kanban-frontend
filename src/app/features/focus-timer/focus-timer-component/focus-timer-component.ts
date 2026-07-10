import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service'; // Pfad prüfen!
import { Todo } from '../../../core/models/todo';
import { FocusDataManagerService } from '../../../core/services/focus-data-manager';

@Component({
  selector: 'app-focus-timer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './focus-timer-component.html',
  styleUrl: './focus-timer-component.css'
})
export class FocusTimerComponent implements OnDestroy {
  private todoService = inject(TodoService);
  private focusDataManager = inject(FocusDataManagerService);

  // 📝 Alle offenen To-Dos für das Dropdown aus deinem reaktiven Service-Signal
  protected openTodos = this.todoService.openTodosOnly;
  protected selectedTodo = signal<Todo | null>(null);
  protected showSuccessCelebration = signal<boolean>(false);
  protected isSyncOffline = signal<boolean>(false);

  // ⏳ Timer-States (Standard Pomodoro: 25 Minuten = 1500 Sekunden)
  private readonly DEFAULT_TIME = 15;
  protected totalSecondsLeft = signal<number>(this.DEFAULT_TIME);
  protected isRunning = signal<boolean>(false);
  private timerIntervalId: any = null;
  protected showTodoValidationError = signal<boolean>(false);

  // 🧠 Berechnete Signale für die schöne UI-Anzeige
  protected displayTime = computed(() => {
    const minutes = Math.floor(this.totalSecondsLeft() / 60);
    const seconds = this.totalSecondsLeft() % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  constructor() {
    // 🌟 MAGIE: Schreibt die Zeit live in den Browsertab!
    effect(() => {
      if (this.isRunning()) {
        document.title = `(${this.displayTime()}) Fokussiert... 🎯`;
      } else {
        document.title = 'Schulung To-Do App'; // Dein Standard-Titel
      }
    });
  }

  protected toggleTimer(): void {
    if (this.isRunning()) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  private startTimer(): void {
    this.isRunning.set(true);
    this.timerIntervalId = setInterval(() => {
      if (this.totalSecondsLeft() > 0) {
        this.totalSecondsLeft.update(s => s - 1);
      } else {
        this.handleTimerFinished();
      }
    }, 1000);
  }

  private pauseTimer(): void {
    this.isRunning.set(false);
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
    }
  }

  protected resetTimer(): void {
    this.pauseTimer();
    this.totalSecondsLeft.set(this.DEFAULT_TIME);
  }

  // 2. Die fertige Methode umschreiben:
private handleTimerFinished(): void {
  this.pauseTimer();
  const todo = this.selectedTodo();
  
  if (todo) {
    this.focusDataManager.recordCompletedPomodoro(todo.id).subscribe({
      next: (result) => {
        if (result) {
          this.isSyncOffline.set(false);
        } else {
          this.isSyncOffline.set(true);
        }
        
        // 🎉 Visuelle Feier starten!
        this.showSuccessCelebration.set(true);
        
        // ❌ DAS TIMEOUT HABEN WIR HIER REAUSGEWORFEN! 
        // Das Pop-up bleibt, bis du selbst klickst.
      },
      error: (err) => {
        this.isSyncOffline.set(true);
        this.showSuccessCelebration.set(true);
      }
    });
  }
  
  this.totalSecondsLeft.set(this.DEFAULT_TIME);
}

  ngOnDestroy(): void {
    this.pauseTimer();
    document.title = 'Schulung To-Do App'; // Beim Verlassen der Seite den Tab aufräumen
  }
}