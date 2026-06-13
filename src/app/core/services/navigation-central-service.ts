import { Injectable, signal, computed } from '@angular/core';

export interface NavigationStep {
  target: string;        // Wo wollen wir hin? (Tab-Name oder Seiten-Name)
  contextType?: string;  // Welcher Typ von Daten reist mit? (z.B. 'PROJECT')
  contextId?: string;    // Die konkrete ID (z.B. project.id)
}

@Injectable({
  providedIn: 'root'
})
export class NavigationCentralService {
  // 🧭 1. Die Historie aller Schritte als internes Signal (unser Stack)
  private historyStack = signal<NavigationStep[]>([]);

  // 👑 2. DER AKTUELL AKTIVE SCHRITT
  // Wir lesen einfach immer das letzte Element aus dem Stack ab!
  // Wenn der Stack leer ist, definieren wir eine Standard-Startseite (z.B. 'pinboard')
  public currentStep = computed<NavigationStep>(() => {
    const stack = this.historyStack();
    if (stack.length === 0) {
      return { target: 'pinboard' }; // Fallback-Startseite
    }
    return stack[stack.length - 1];
  });

  /**
   * 🚀 VORWÄRTS NAVIGIEREN
   * Legt einen neuen Schritt auf den Stack.
   */
  public navigateTo(target: string, contextType?: string, contextId?: string): void {
    const newStep: NavigationStep = { target, contextType, contextId };
    
    // Wir aktualisieren den Stack reaktiv
    this.historyStack.update(currentStack => [...currentStack, newStep]);
    console.log('➡️ Navigation Vorwärts zu:', newStep, 'Stack-Größe:', this.historyStack().length);
  }

  /**
   * ↩️ RÜCKWÄRTS NAVIGIEREN (Back-Verwaltung)
   * Nimmt den aktuellen Schritt vom Stack runter, wodurch der vorherige Schritt aktiv wird.
   */
  public goBack(): void {
    this.historyStack.update(currentStack => {
      if (currentStack.length <= 1) {
        console.log('🛑 History ist am Startpunkt angekommen, kann nicht weiter zurück.');
        return currentStack; // Nicht unter die Startseite fallen
      }
      
      const updatedStack = currentStack.slice(0, -1);
      console.log('↩️ Navigation Zurück. Neuer Top-Schritt:', updatedStack[updatedStack.length - 1]);
      return updatedStack;
    });
  }

  /**
   * 🧼 RESET / DIREKT-EINSTIEG
   * Falls man die History komplett löschen und neu anfangen will (z.B. beim ersten Laden)
   */
  public resetTo(target: string): void {
    this.historyStack.set([{ target }]);
  }
}