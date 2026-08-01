import { Component, inject, signal, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user/user-service';
import { PlannerService } from '../../../core/services/ai/planner-service';
import { NotificationService } from '../../../core/services/notification/notification-service';
import { Todo } from '../../../core/models/todo';

@Component({
  selector: 'app-planner-recommendation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planner-recommendation-component.html',
  styleUrls: ['./planner-recommendation-component.css']
})
export class PlannerRecommendationComponent {
  private userService = inject(UserService);
  public plannerService = inject(PlannerService);
  private notificationService = inject(NotificationService)

  closeRequest = output<{ accepted: boolean; todoId: string }>();
  showFeedbackReasons = signal<boolean>(false);
  isComputing = computed(() => this.plannerService.isLoading());

  // 🌐 Unser Wörterbuch für die Internationalisierung (Frontend-Driven UI)
  PLANNER_MESSAGES: { [key in 'de' | 'en']: { [textKey: string]: string } } = {
    de: {
      DEFAULT_TITLE: 'Deine Empfehlung',
      DEFAULT_DESC: 'Hier ist dein nächstes To-Do.',

      // 🧠 Die neuen Begründungen für das Barometer (Deutsch)
      REASON_DEFAULT: 'Weil diese Aufgabe perfekt in deinen aktuellen Tag passt.',
      REASON_LOW_ENERGY_SHORT_TIME: 'Weil deine Energie niedrig ist und du gerade wenig Zeit hast.',
      REASON_NO_TODOS_LEFT: 'Hervorragend! Du hast alle Aufgaben für heute erledigt.'
    },
    en: {
      DEFAULT_TITLE: 'Your Recommendation',
      DEFAULT_DESC: 'Here is your next to-do.',

      // 🧠 Die neuen Begründungen für das Barometer (Englisch - schon fertig für GitHub!)
      REASON_DEFAULT: 'Because this task fits perfectly into your current day.',
      REASON_LOW_ENERGY_SHORT_TIME: 'Because your energy is low and you are short on time.',
      REASON_NO_TODOS_LEFT: 'Excellent! You have completed all tasks for today.'
    }
  };
  currentLanguage: 'de' | 'en' = 'de';// Hier simulieren wir erst mal Deutsch

  constructor() {
    this.loadNextRecommendation();
  }

  // Helper-Getters für ein saubereres HTML
  get titleKey(): string {
    const code = this.plannerService.aiResponseCode()?.reasonCode;
    return code ? `${code}_TITLE` : 'DEFAULT_TITLE';
  }

  get descKey(): string {
    const code = this.plannerService.aiResponseCode()?.reasonCode;
    return code ? `${code}_DESC` : 'DEFAULT_DESC';
  }

  acceptTodo(todo: any) {
    console.log('🚀 Starten geklickt für:', todo.task);

    // 1. Feedback an den Server senden (damit die KI lernt: Das mag der User!)
    const currentEnergy = this.userService.userEnergy();
    this.plannerService.sendFeedback(todo.id, true, null, currentEnergy);

    // 2. Event nach oben feuern, um den Banner auf dem Dashboard zu aktivieren
    this.closeRequest.emit({ accepted: true, todoId: todo.id });
  }

  rejectTodo() {
    this.showFeedbackReasons.set(true);
  }

  cancelReject() {
    this.showFeedbackReasons.set(false);
  }

  sendDetailedFeedback(todo: any, reason: 'no_motivation' | 'too_heavy' | 'too_long') {
    console.log('Feedback gesendet:', reason);
    const currentEnergy = this.userService.userEnergy();

    // 🎯 REIHENFOLGE ERZWUNGEN: Wir subscriben direkt auf den Service-Call!
    this.plannerService.sendFeedback(todo.id, false, reason, currentEnergy).subscribe({
      next: () => {
        this.loadNextRecommendation();
      },
      error: (err) => {
        console.error('Feedback fehlgeschlagen:', err);

        // 1. Schicke Toast-Nachricht auf den Bildschirm 🍿
        this.notificationService.showNotification(
          'Verbindung abgebrochen! Dein Feedback konnte nicht gespeichert werden.',
          'error'
        );

        // 2. Wir schleißen die Empfehlungs-Komponente, 
        // damit der User nicht auf dem alten To-Do hängen bleibt.
        this.closeRequest.emit({ accepted: false, todoId: todo.id });
      }
    });
  }

  loadNextRecommendation() {
    console.log('startet loading neuer Rekomendation')
    this.showFeedbackReasons.set(false);

    const energy = this.userService.userEnergy();
    const timeLeft = this.userService.workingTimeLeft();

    // 🚀 RAUS MIT DEM MOCK! Wir rufen jetzt die echte Server-Logik auf:
    this.plannerService.loadSmartRecommendation(energy, timeLeft);
  }

  // 🧠 Das Stimmungs-Barometer zieht sich jetzt die ECHTEN Daten vom Server
  get moodExplanation(): { icon: string, text: string } | null {
    const aiResponse = this.plannerService.aiResponseCode(); // recommendedTodoResponse
    const todo = this.plannerService.recommendedTodo();

    if (!aiResponse || !aiResponse.reasonCode || !todo) return null;

    const code = aiResponse.reasonCode;

    // 1. Dein genialer Inkubations-Spezialfall (Bleibt als Premium-Feature im Frontend!)
    if (code === 'LOW_ENERGY_SHORT_TIME' && todo.effort > 1) {
      return {
        icon: '🛌💤',
        text: this.currentLanguage === 'de'
          ? 'Code-Inkubation: Lies dir das Ticket jetzt nur entspannt durch. Dein Unterbewusstsein löst es heute Nacht im Schlaf!'
          : 'Code Incubation: Just read through the ticket relaxedly. Your subconscious will solve it in your sleep tonight!'
      };
    }

    // 2. Dynamischer Text basierend auf dem Server-Code und der aktuellen Sprache
    const textKey = `REASON_${code}`;
    const translatedText = this.PLANNER_MESSAGES[this.currentLanguage][textKey] ||
      this.PLANNER_MESSAGES[this.currentLanguage]['REASON_DEFAULT'];

    return {
      icon: this.getIconForCode(code),
      text: translatedText
    };
  }

  // Hilfsfunktion für die passenden Icons zu deinen echten Server-Codes
  private getIconForCode(code: string): string {
    switch (code) {
      case 'LOW_ENERGY_SHORT_TIME': return '🔋';
      case 'NO_TODOS_LEFT': return '🎉';
      default: return '💡';
    }
  }

  public snoozeTodo(todo: Todo) {
    console.log('Ticket gesnoozed:', todo.task);
    this.plannerService.snoozyrecommendedTodo(todo.id, 5).subscribe({
      next: () => {
        console.log('Server Antwort ist gekommen Ticket gesnoozed:', todo.task);
        setTimeout(() => {
          this.loadNextRecommendation();
        }, 300);
      },
      error: () => {
        this.notificationService.showNotification(
          "Verbindung abgebrochen! Todo konnte nicht auf Warten gestellt werden.", 'error');
      }

    })
  }
}