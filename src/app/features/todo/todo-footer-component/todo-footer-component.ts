import { Component, computed, inject, input, signal } from '@angular/core';
import { TodoService } from '../../../core/services/todo/todo-service'; // Pfad anpassen
import { ConnectionService } from '../../../core/services/connection-service';
import { UniversalPopupComponent } from '../../../core/shared/components/universal-popup-component/universal-popup-component';
import { Todo } from '../../../core/models/todo';

@Component({
  selector: 'app-todo-footer',
  standalone: true,
  imports: [UniversalPopupComponent], // <-- Komplett leer! Keine TodoListComponent nötig!
  templateUrl: './todo-footer-component.html',
  styleUrl: './todo-footer-component.css'
})

export class TodoFooterComponent {
  protected todoService = inject(TodoService);
  protected connectionService = inject(ConnectionService)

  public currentTodos = input.required<Todo[]>();

  public totalOpenEffort = computed(() => {
    // Keine Typen-Prüfung mehr nötig, da es garantiert Todo[] ist!
    const openTodos = this.currentTodos().filter(t => !t.done);
    return openTodos.reduce((prev, t) => prev + (t.effort || 0), 0);
  });

  public isListEmpty = computed(() => {
    return this.currentTodos().length === 0;
  });
  
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

  public disableDeleteButtons = computed(() => {
     return this.connectionService.status() === "OFFLINE"
  })


  onClearCompleted(): void {
    // Statt confirm() öffnen wir lokal das schöne Universal-Popup
    this.activePopupConfig.set({
      title: 'Erledigte Aufgaben archivieren',
      message: 'Möchten Sie wirklich alle abgeschlossenen privaten Aufgaben löschen? Dieser Vorgang wird nach Ablauf des Balkens automatisch ausgeführt.',
      mode: 'danger',
      animationIcon: '🗑️',
      confirmText: 'Jetzt löschen',
      cancelText: 'Abbrechen',
      showLoadingBar: true,
      timerMs: 4000, // 4 Sekunden Timer
      action: () => {
        // Erst wenn der Timer abläuft oder bestätigt wird, geht der Request an den Service!
        this.todoService.clearCompletedTodos();
      }
    });
  }

  // 🗑️ Footer rechts (Alle privaten Aufgaben löschen)
  onClearAll(): void {
    this.activePopupConfig.set({
      title: 'Gesamtes privates Board leeren',
      message: '<strong>Achtung!</strong> Sie sind im Begriff, ALLE Ihre privaten Aufgaben zu löschen. Möchten Sie das wirklich tun?',
      mode: 'danger',
      animationIcon: '🔥',
      confirmText: 'Ja, alles leeren',
      cancelText: 'Nein, stoppen!',
      showLoadingBar: true,
      timerMs: 5000, // 5 Sekunden für maximale Sicherheit
      action: () => {
        // Erst wenn der Timer abläuft oder bestätigt wird, geht der Request an den Service!
        this.todoService.clearAllTodos();
      }
    });

  }

  protected closePopup(): void {
    this.activePopupConfig.set(null);
  }
}