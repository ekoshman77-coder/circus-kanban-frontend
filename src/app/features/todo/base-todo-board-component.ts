import { Component, inject, signal } from '@angular/core';
import { TodoService } from '../../core/services/todo/todo-service';

@Component({
  template: '' // Abstrakt, kein eigenes Template nötig!
})
export abstract class BaseTodoBoardComponent {
  protected todoService = inject(TodoService);

  // 🧠 Das geteilte Popup-Signal für beide Boards
  protected activePopupConfig = signal<{
    title: string;
    message: string;
    mode: 'success' | 'danger';
    animationIcon: string;
    confirmText?: string;
    cancelText: string;
    showLoadingBar: boolean;
    timerMs: number;
    action: () => void;
  } | null>(null);

  // 🗑️ Geteilte Logik für erledigte Aufgaben
  public onOpenClearCompletedPopup(): void {
    this.activePopupConfig.set({
      title: 'Erledigte Aufgaben löschen',
      message: 'Möchten Sie wirklich alle abgeschlossenen privaten Aufgaben löschen? Dieser Vorgang wird nach Ablauf des Balkens automatisch ausgeführt.',
      mode: 'danger',
      animationIcon: '🗑️',
      confirmText: 'Jetzt löschen',
      cancelText: 'Abbrechen',
      showLoadingBar: true,
      timerMs: 4000,
      action: () => this.todoService.clearCompletedTodos()
    });
  }

  // 🗑️ Geteilte Logik für alle Aufgaben
  public onOpenClearAllPopup(): void {
    this.activePopupConfig.set({
      title: 'Gesamtes privates Board leeren',
      message: '<strong>Achtung!</strong> Sie sind im Begriff, ALLE Ihre privaten Aufgaben zu löschen. Möchten Sie das wirklich tun?',
      mode: 'danger',
      animationIcon: '🔥',
      confirmText: 'Ja, alles leeren',
      cancelText: 'Nein, stoppen!',
      showLoadingBar: true,
      timerMs: 5000,
      action: () => this.todoService.clearAllTodos()
    });
  }

  protected closePopup(): void {
    this.activePopupConfig.set(null);
  }
}