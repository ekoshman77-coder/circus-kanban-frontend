import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service'; // Pfad prüfen!
import { Todo } from '../../../core/models/todo';
import { FocusDataManagerService } from '../../../core/services/focus/focus-data-manager-service';

/**
 * FocusTimerComponent steuert die Logik des Pomodoro-Timers.
 * Sie überwacht die verbleibende Zeit, verwaltet den Start-/Pausen-Zustand
 * und meldet abgeschlossene Fokus-Sitzungen an das Backend.
 */
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

  // Alle offenen To-Dos für das Dropdown aus deinem reaktiven Service-Signal
  protected openTodos = this.todoService.openTodosOnly;

  /** Das aktuell ausgewählte To-Do für die Fokus-Sitzung. */
  protected selectedTodo = signal<Todo | null>(null);
  /** Steuert die Sichtbarkeit des Erfolgs-Popups nach einer abgeschlossenen Sitzung. */
  protected showSuccessCelebration = signal<boolean>(false);
  protected isSyncOffline = signal<boolean>(false);

  // ⏳ Timer-States (Standard Pomodoro: 25 Minuten = 1500 Sekunden)
  private readonly DEFAULT_TIME = 1500;
  protected totalSecondsLeft = signal<number>(this.DEFAULT_TIME);
  /** Gibt an, ob das Countdown-Intervall aktuell aktiv ist. */
  protected isRunning = signal<boolean>(false);
  /** Die verbleibende Zeit in Sekunden (Standard: 1500 Sekunden / 25 Minuten). */
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

  /**
   * Schaltet den Timer-Zustand zwischen "läuft" und "pausiert" um.
   * Verhindert das Starten des Timers, wenn kein To-Do ausgewählt ist.
   */
  protected toggleTimer(): void {
    if (this.isRunning()) {
      this.pauseTimer();
    } else {
      if (this.selectedTodo()) {
        this.startTimer();
      }
    }
  }

  /**
   * Startet das Countdown-Intervall und aktualisiert die verbleibende Zeit jede Sekunde.
   * Triggert den Abschluss-Workflow, sobald die Zeit Null erreicht.
   */
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

  /**
   * Pausiert das Countdown-Intervall und stoppt die zeitliche Aktualisierung.
   */
  private pauseTimer(): void {
    this.isRunning.set(false);
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
    }
  }

  /**
   * Setzt den Timer wieder auf seinen Anfangswert (1500 Sekunden) zurück.
   * Sollte idealerweise aufgerufen werden, wenn der Timer pausiert ist.
   */
  protected resetTimer(): void {
    this.pauseTimer();
    this.totalSecondsLeft.set(this.DEFAULT_TIME);
  }

  /**
   * Setzt den Timer wieder zurück und schickt das Todo zum server für Bearbeitung.
   */
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