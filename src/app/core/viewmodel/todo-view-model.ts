import { computed, inject, signal } from "@angular/core";
import { Todo, VisualStatus } from "../models/todo";
import { TodoService } from "../services/todo/todo-service";

export class TodoViewModel {

    public showEffortPopup = signal<boolean>(false);
    public pendingTodo = signal<Todo | null>(null);
    public popupEffortValue = signal<number>(0);       // Effort für Dev
    public popupReviewerEffortValue = signal<number>(0); // Effort für Reviewer

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
    // todo-view-model.ts

    public onTodoChecked(todoService: TodoService, currentUserId?: string, onReviewTriggered?: (todo: Todo) => void): void {
        if (!this.todo.done) {
            // 🚀 A) TEAM-TODO:
            if (this.todo.milestoneId) {
                // Wenn es noch IN_PROGRESS ist -> ab ins REVIEW
                if (this.todo.teamStatus === 'IN_PROGRESS') {
                    const updatedTodo = Todo.fromTodo(this.todo);
                    updatedTodo.teamStatus = 'REVIEW';
                    updatedTodo.lastDeveloperId = currentUserId ?? null;
                    updatedTodo.assignedUserId = null;

                    todoService.updateTodo(updatedTodo, true);
                    this.pendingTodo.set(updatedTodo);

                    if (onReviewTriggered) {
                        onReviewTriggered(updatedTodo);
                    }
                    return;
                }

                // Wenn es schon im REVIEW ist und abgehakt wird -> DONE-Workflow mit Popup starten!
                if (this.todo.teamStatus === 'REVIEW') {
                    this.triggerDoneWorkflow();
                    return;
                }
            }

            // 📝 B) PRIVATES TODO: Story-Points Abfrage
            const recommendedEffort = this.todo.usedEffort > 0 ? this.todo.usedEffort : this.todo.effort;
            this.popupEffortValue.set(recommendedEffort);
            this.showEffortPopup.set(true);
            return;
        }

        // Wieder öffnen (aus DONE zurücksetzen)
        todoService.toggleComplete(this.id, this.todo.usedEffort);
    }

    /**
     * Bereitet die Signals für das Auslesen von Dev- & Reviewer-Effort vor
     */
    public triggerDoneWorkflow(): void {
        console.log("triggerDoneWorkflow", this.todo)
        const devEffort = this.todo.usedEffort > 0 ? this.todo.usedEffort : this.todo.effort;
        const revEffort = this.todo.reviewerUsedEffort > 0 ? this.todo.reviewerUsedEffort : 1;

        this.popupEffortValue.set(devEffort);
        this.popupReviewerEffortValue.set(revEffort);
        this.showEffortPopup.set(true);
    }

    /**
     * Bestätigt den Aufwand für BEIDE Parteien und schließt das Ticket.
     */
    public onEffortConfirmed(finalDevEffort: number, finalReviewerEffort: number, todoService: TodoService): void {
        this.showEffortPopup.set(false);

        const updatedTodo = Todo.fromTodo(this.todo);
        updatedTodo.teamStatus = 'DONE';
        updatedTodo.done = true;
        updatedTodo.completedAt = Date.now();

        // 🎯 Aufwände eintragen
        updatedTodo.usedEffort = finalDevEffort;
        updatedTodo.reviewerUsedEffort = finalReviewerEffort;
        updatedTodo.assignedUserId = null

        todoService.updateTodo(updatedTodo, true);
    }


    public cancelEffortPopup(): void {
        console.log("ViewModel", "cancelEffortPopup");
        this.showEffortPopup.set(false);
    }
}