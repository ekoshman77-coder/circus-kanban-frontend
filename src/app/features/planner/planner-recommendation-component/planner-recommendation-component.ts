import { Component, inject, signal, output } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user/user-service';
import { PlannerService } from '../../../core/services/planner-service';

@Component({
  selector: 'app-planner-recommendation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planner-recommendation-component.html',
  styleUrls: ['./planner-recommendation-component.css']
})
export class PlannerRecommendationComponent {
  private userService = inject(UserService);
  public plannerService = inject(PlannerService); // 👈 Auf 'public' geändert, damit das HTML direkt auf die Signals zugreifen kann!

  showFeedbackReasons = signal<boolean>(false);
  closeRequest = output<{ accepted: boolean; todoId: string }>();

  // 🌐 Unser Wörterbuch für die Internationalisierung (Frontend-Driven UI)
  readonly PLANNER_MESSAGES: Record<string, Record<string, string>> = {
    de: {
      'LOW_ENERGY_SHORT_TIME_TITLE': '📖 Recherche-Modus aktiviert:',
      'LOW_ENERGY_SHORT_TIME_DESC': 'Keine passenden leichten Aufgaben mehr da. Nutze die Zeit, um dich entspannt in diesen großen Brocken einzulesen... ☕',
      'NO_TODOS_LEFT_TITLE': '🎉 Alles erledigt!',
      'NO_TODOS_LEFT_DESC': 'Du hast absolut keine offenen Aufgaben mehr auf deinem Board. Ab in die Oase! 🌴',
      'DEFAULT_TITLE': '🔮 Dein KI-Tages-Planer',
      'DEFAULT_DESC': 'Basierend auf deiner Energie und deinem biologischen Rhythmus empfehlen wir:'
    },
    en: {
      'LOW_ENERGY_SHORT_TIME_TITLE': '📖 Research Mode Activated:',
      'LOW_ENERGY_SHORT_TIME_DESC': 'No easy tasks left. Use the remaining time to relaxed-ly read into this big ticket... ☕',
      'NO_TODOS_LEFT_TITLE': '🎉 All done!',
      'NO_TODOS_LEFT_DESC': 'You have absolutely no open tasks left on your board. Time to relax! 🌴',
      'DEFAULT_TITLE': '🔮 Your Smart AI Planner',
      'DEFAULT_DESC': 'Based on your energy and biological rhythm, we recommend:'
    }
  };

  currentLanguage = 'de'; // Hier simulieren wir erst mal Deutsch

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

    // 1. Feedback via Service an das Backend jagen (Der Frust-Hammer wartet dort! 🔨)
    this.plannerService.sendFeedback(todo.id, false, reason, currentEnergy);

    // 2. Direkt die nächste Empfehlung laden – ohne die nervige alte Aufgabe!
    this.loadNextRecommendation();
  }

  loadNextRecommendation() {
    this.showFeedbackReasons.set(false);

    const energy = this.userService.userEnergy();
    const timeLeft = this.userService.workingTimeLeft();

    // 🚀 RAUS MIT DEM MOCK! Wir rufen jetzt die echte Server-Logik auf:
    this.plannerService.loadSmartRecommendation(energy, timeLeft);
  }
}