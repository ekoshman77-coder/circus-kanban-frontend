import { computed, inject, signal } from "@angular/core";
import { Todo, VisualStatus } from "../models/todo";
import { TodoService } from "../services/todo/todo-service";

export class TodoViewModel {

    public showEffortPopup = signal<boolean>(false);
    public pendingTodo = signal<Todo | null>(null);
    public popupEffortValue = signal<number>(0);
    public showAssigneePopup = signal<boolean>(false); // 🚀 NEU: Steuert lokal das Zuweisungs-Popup

    // 🌟 DAS NEUE REAKTIVE SIGNAL FÜR DIE BEWERTUNG
    // Es berechnet sich vollautomatisch, sobald das Todo geladen oder geändert wird!
    public estimationStatus = computed<'MATCH' | 'FASTER' | 'SLOWER' | 'NONE'>(() => {
        // Falls das Todo offen ist oder noch gar kein Aufwand eingetragen wurde
        if (!this.todo.done || this.todo.usedEffort === 0) {
            return 'NONE';
        }
        
        if (this.todo.usedEffort === this.todo.effort) {
            return 'MATCH';
        } 
        
        if (this.todo.usedEffort < this.todo.effort) {
            return 'FASTER';
        } 
        
        return 'SLOWER';
    });

    // Wir machen das originale Domänen-Modell lesbar zugänglich
    constructor(
        public readonly todo: Todo,
        public readonly isDescriptionOpen: boolean
    ) { }

    // 🛡️ Getter-Delegation: Reicht die Werte typsicher aus der echten Klasse weiter
    get id(): string { return this.todo.id; }
    get task(): string { return this.todo.task; }
    get description(): string | null { return this.todo.description; }
    get done(): boolean { return this.todo.done; }
    get effort(): number { return this.todo.effort; }
    get category(): string | null { return this.todo.category; }

    // 🧠 Logische Kapselung der Oberflächen-Zustände (Dein Java-Herz lacht!)
    get visualStatus(): VisualStatus {
        return this.todo.getVisualStatus();
    }

    get timestamp(): number {
        return this.todo.getTimeStamp();
    }

    get dateText(): string {
        return this.todo.done ? 'Erledigt ' : 'Fällig ';
    }

    /**
   * 1. Der User klickt auf "Erledigen" im UI
   */
    public onTodoChecked(todoService: TodoService): void {
        console.log("ViewModel", "onTodoChecked");

        if (!this.todo.done) {
            // 🧠 Das ViewModel trifft die Entscheidung, BEVOR das Popup öffnet!
            // Wenn usedEffort bereits existiert (> 0), schlagen wir den vor.
            // Ansonsten nehmen wir die ursprüngliche Schätzung (effort).
            const recommendedEffort = this.todo.usedEffort > 0 ? this.todo.usedEffort : this.todo.effort;

            // Wir befüllen das dedizierte Signal
            this.popupEffortValue.set(recommendedEffort);

            // Popup anzeigen
            this.showEffortPopup.set(true);
        } else {
            // Wenn das Todo wieder geöffnet wird, bleibt der historische Aufwand unverändert
            todoService.toggleComplete(this.id, this.todo.usedEffort);
        }
    }

    /**
     * 2. User confirms the effort in the popup
     */
    public onEffortConfirmed(finalEffort: number, todoService: TodoService): void {
        console.log("ViewModel", "onEffortConfirmed");

        this.showEffortPopup.set(false);

        // Wir übergeben den Wert aus dem Signal/Input direkt an den Service
        todoService.toggleComplete(this.id, finalEffort);
    }

    public cancelEffortPopup() {
        this.showEffortPopup.set(false)
    }
}