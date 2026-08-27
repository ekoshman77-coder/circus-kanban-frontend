import { computed, inject, signal } from "@angular/core";
import { Todo, VisualStatus } from "../models/todo";
import { TodoService } from "../services/todo/todo-service";

export class TodoViewModel {

    public showEffortPopup = signal<boolean>(false);
    public pendingTodo = signal<Todo | null>(null);
    public popupEffortValue = signal<number>(0);
    public showAssigneePopup = signal<boolean>(false);

    public estimationStatus = computed<'MATCH' | 'FASTER' | 'SLOWER' | 'NONE'>(() => {
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

    // 💡 HIER ERWEITERT: visualStatus, canEdit und canDelete direkt im Konstruktor aufnehmen!
    constructor(
        public readonly todo: Todo,
        public readonly isDescriptionOpen: boolean,
        //        public readonly visualStatus: string = 'on-time', // "on-time", "completed", etc.
        public readonly canEdit: boolean = false,
        public readonly canDelete: boolean = false
    ) { }

    get id(): string { return this.todo.id; }
    get task(): string { return this.todo.task; }
    get description(): string | null { return this.todo.description; }
    get effort(): number { return this.todo.effort; }
    get category(): string | null { return this.todo.category; }

    // 🧠 Logische Kapselung der Oberflächen-Zustände (Dein Java-Herz lacht!)
    get visualStatus(): VisualStatus {
        return this.todo.getVisualStatus();
    }

    get done(): boolean {
        return this.todo.done
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
    public onTodoChecked(todoService: TodoService, currentUserId?: string, onReviewTriggered?: (todo: Todo) => void): void {
        console.log("ViewModel", "onTodoChecked");

        if (!this.todo.done) {
            // 🚀 A) TEAM-TODO: In den REVIEW-Status verschieben
            if (this.todo.milestoneId) {
                const updatedTodo = Todo.fromTodo(this.todo);
                updatedTodo.teamStatus = 'REVIEW';
                updatedTodo.lastDeveloperId = currentUserId ?? null;
                updatedTodo.assignedUserId = null;

                todoService.updateTodo(updatedTodo, true);

                // 💡 HIER IST DER SCHLÜSSEL: Das Signal setzen!
                this.pendingTodo.set(updatedTodo);

                if (onReviewTriggered) {
                    onReviewTriggered(updatedTodo);
                }
                return;
            }

            // 📝 B) PRIVATES TODO: Story-Points Abfrage
            const recommendedEffort = this.todo.usedEffort > 0 ? this.todo.usedEffort : this.todo.effort;
            this.popupEffortValue.set(recommendedEffort);
            this.showEffortPopup.set(true);
            return;
        }

        // Wieder öffnen
        todoService.toggleComplete(this.id, this.todo.usedEffort);
    }

    public onEffortConfirmed(finalEffort: number, todoService: TodoService): void {
        this.showEffortPopup.set(false);

        // 🚀 A) TEAM-TODO:
        if (this.todo.milestoneId) {
            const updatedTodo = Todo.fromTodo(this.todo);
            updatedTodo.teamStatus = 'DONE';
            updatedTodo.done = true;                 // 🎯 Wichtig für Streak / Batterie
            updatedTodo.usedEffort = finalEffort;     // 🎯 Wichtig für Aufwandsberechnung
            updatedTodo.completedAt = Date.now();

            todoService.updateTodo(updatedTodo, true);
            return;
        }

        // 📝 B) PRIVATES TODO:
        todoService.toggleComplete(this.id, finalEffort);
    }
    
    public cancelEffortPopup(): void {
        console.log("ViewModel", "cancelEffortPopup");
        this.showEffortPopup.set(false);
    }

    /**
     * Triggert den Workflow zum Schließen einer Aufgabe (z. B. aus dem Kanban-Board).
     * Bereitet den Status vor und öffnet das Effort-Popup des ViewModels.
     */
    public triggerDoneWorkflow(): void {
        // 1. Status & Meta-Daten für DONE vorbereiten
        this.todo.teamStatus = 'DONE';
        this.todo.assignedUserId = null;
        this.todo.completedAt = Date.now();

        // 2. Empfohlenen Aufwand berechnen
        const recommendedEffort = this.todo.usedEffort > 0 ? this.todo.usedEffort : this.todo.effort;

        // 3. Popup-Signals im ViewModel aktivieren
        this.popupEffortValue.set(recommendedEffort);
        this.showEffortPopup.set(true);
    }

}