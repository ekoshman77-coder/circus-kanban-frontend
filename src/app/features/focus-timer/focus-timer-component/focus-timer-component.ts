import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service'; // Pfad prüfen!
import { Todo } from '../../../core/models/todo';

@Component({
  selector: 'app-focus-timer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './focus-timer-component.html',
  styleUrl: './focus-timer-component.css'
})
export class FocusTimerComponent implements OnDestroy {
  private todoService = inject(TodoService);

  // 📝 Alle offenen To-Dos für das Dropdown aus deinem reaktiven Service-Signal
  protected openTodos = this.todoService.openTodosOnly; 
  protected selectedTodo = signal<Todo | null>(null);

  // ⏳ Timer-States (Standard Pomodoro: 25 Minuten = 1500 Sekunden)
  private readonly DEFAULT_TIME = 1500;
  protected totalSecondsLeft = signal<number>(this.DEFAULT_TIME);
  protected isRunning = signal<boolean>(false);
  private timerIntervalId: any = null;

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
    if (!this.selectedTodo()) {
      alert('Wähle zuerst eine Aufgabe aus, auf die du dich fokussieren willst! 🎯');
      return;
    }
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

  private handleTimerFinished(): void {
    this.pauseTimer();
    const todo = this.selectedTodo();
    
    if (todo) {
      // 🚀 GAME-UPGRADE: +1 usedEffort auf die Aufgabe rechnen!

      this.todoService.addPoint(todo.id); 
      
      alert(`🎉 Super Arbeit! 25 Minuten Fokus geschafft. Wir haben 1 Aufwandspunkt auf "${todo.task}" gebucht!`);
    }
    this.totalSecondsLeft.set(this.DEFAULT_TIME);
  }

  ngOnDestroy(): void {
    this.pauseTimer();
    document.title = 'Schulung To-Do App'; // Beim Verlassen der Seite den Tab aufräumen
  }
}