import { computed, inject, Injectable, signal } from '@angular/core';
import { FocusDataManagerService } from './focus-data-manager-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';

export type TimerState = 'idle' | 'running' | 'paused';

@Injectable({
  providedIn: 'root'
})
export class FocusService extends BaseDataManager {
  private dataManager = inject(FocusDataManagerService);

  // Standard-Pomodoro-Dauer in Sekunden (25 Min)
  private readonly DEFAULT_POMODORO_SECONDS = 25 * 60;

  private timerStateSignal = signal<TimerState>('idle');
  public readonly timerState = this.timerStateSignal.asReadonly();

  private timeRemainingSignal = signal<number>(this.DEFAULT_POMODORO_SECONDS);
  public readonly timeRemaining = this.timeRemainingSignal.asReadonly();

  private activeTodoIdSignal = signal<string | null>(null);
  public readonly activeTodoId = this.activeTodoIdSignal.asReadonly();

  private timerInterval: any = null;

  public readonly isRunning = computed(() => this.timerStateSignal() === 'running');
  public readonly isPaused = computed(() => this.timerStateSignal() === 'paused');

  public setActiveTodo(todoId: string | null): void {
    this.activeTodoIdSignal.set(todoId);
  }

  public startTimer(durationSeconds: number = this.DEFAULT_POMODORO_SECONDS): void {
    if (this.timerStateSignal() === 'idle') {
      this.timeRemainingSignal.set(durationSeconds);
    }

    this.timerStateSignal.set('running');
    this.clearInterval();

    this.timerInterval = setInterval(() => {
      const current = this.timeRemainingSignal();
      if (current > 1) {
        this.timeRemainingSignal.set(current - 1);
      } else {
        this.completePomodoro();
      }
    }, 1000);
  }

  public pauseTimer(): void {
    if (this.timerStateSignal() === 'running') {
      this.timerStateSignal.set('paused');
      this.clearInterval();
    }
  }

  public resetTimer(durationSeconds: number = this.DEFAULT_POMODORO_SECONDS): void {
    this.clearInterval();
    this.timerStateSignal.set('idle');
    this.timeRemainingSignal.set(durationSeconds);
  }

  /**
   * Manuelles Verbuchen eines Pomodoros (z. B. aus der Komponente heraus)
   */
  public recordCompletedPomodoro(todoId: string): void {
    this.dataManager.recordCompletedPomodoro(todoId);
  }

  private completePomodoro(): void {
    this.clearInterval();
    this.timerStateSignal.set('idle');
    this.timeRemainingSignal.set(this.DEFAULT_POMODORO_SECONDS);

    const todoId = this.activeTodoIdSignal();
    if (todoId) {
      this.recordCompletedPomodoro(todoId);
    }
  }

  private clearInterval(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public override checkUnsavedData(): string | null {
    if (this.timerStateSignal() === 'running') {
      return 'Ein Focus-Timer läuft aktuell noch. Möchtest du die Seite wirklich verlassen?';
    }
    return null;
  }

  public override resetData(): void {
    this.clearInterval();
    this.timerStateSignal.set('idle');
    this.timeRemainingSignal.set(this.DEFAULT_POMODORO_SECONDS);
    this.activeTodoIdSignal.set(null);
  }
}