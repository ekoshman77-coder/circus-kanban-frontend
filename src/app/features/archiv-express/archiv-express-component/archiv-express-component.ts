import { Component, inject, signal, ViewChild } from '@angular/core'; // 👈 ViewChild hinzugefügt
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { UserService } from '../../../core/services/user/user-service'; 
import { Todo } from '../../../core/models/todo';
import { TaskCategoryComponent } from '../../todo/task-category-component/task-category-component';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-archiv-express',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskCategoryComponent, MilestoneSelectorComponent],
  templateUrl: './archiv-express-component.html',
  styleUrl: './archiv-express-component.css'
})
export class ArchivExpressComponent {
  private todoService = inject(TodoService);
  private userService = inject(UserService);
  public milestoneId = signal<string | null>(null)

  // 🔌 Zugriff auf die Unterkomponente für den Reset
  @ViewChild('categorySelector') categorySelector!: TaskCategoryComponent;

  protected fibonacciValues: number[] = this.todoService.fibonacciSequence;

  // Startwerte auf die erste Zahl der Sequenz setzen (1)
  protected expressEffort = signal<number>(this.fibonacciValues[0] || 1);
  protected expressUsedEffort = signal<number>(this.fibonacciValues[0] || 1);

  // ⚡ Reaktive Formular-States
  protected expressTask = signal<string>('');
  protected expressDescription = signal<string>('');
  
  // 🏷️ 3. Neues Signal für die Kategorie (Standard: Allgemein)
  protected expressCategory = signal<string>('Allgemein');

  protected submitExpressTodo(): void {
    if (!this.expressTask().trim()) return;

    // Aktuelle User-ID besorgen
    const currentUserId = this.userService.currentUser()?.id || 'default-user';

    // Reihenfolge laut deinem Konstruktor
    const expressTodo = new Todo({
      task: this.expressTask(),
      description: this.expressDescription() || null,
      effort: this.expressEffort(),
      dueDate: Date.now(), 
      userId: currentUserId,
      usedEffort: this.expressUsedEffort(),
      milestoneId: this.milestoneId(),
      isStarted: true
    });

    // Da es direkt ins Archiv soll, setzen wir es sofort auf erledigt
    expressTodo.done = true;
    expressTodo.completedAt = Date.now();
    
    // 🌟 4. Die ausgewählte Kategorie dem To-Do zuweisen!
    expressTodo.category = this.expressCategory() || 'Allgemein';

    // Ab ans Backend via Service senden
    const todo = this.todoService.createTodo(expressTodo); 
    this.todoService.addDoneTodo(todo);
    
    // Formular wieder blitzblank aufräumen
    this.expressTask.set('');
    this.expressDescription.set('');
    this.expressEffort.set(this.fibonacciValues[0] || 1);
    this.expressUsedEffort.set(this.fibonacciValues[0] || 1);
    this.milestoneId.set(null);
    
    // 🚀 5. Kategorie zurücksetzen
    this.expressCategory.set('Allgemein');
    if (this.categorySelector) {
      this.categorySelector.resetField();
    }
  }

  // 📥 6. Event-Handler für die Kategorie-Änderung
  protected onCategoryChanged(category: string): void {
    this.expressCategory.set(category);
  }

  public onMilestoneSelected(id: string | null) {
    this.milestoneId.set(id)
  }
}