import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service'; 
import { UserService } from '../../../core/services/user/user-service'; 
import { Todo } from '../../../core/models/todo';
// 🌟 Geänderter Import passend zum Universal Input aus dem Planning-Modal
import { UniversalTagInputComponent } from '../../../core/shared/components/universal-tag-input-component/universal-tag-input-component';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-archiv-express',
  standalone: true,
  imports: [CommonModule, FormsModule, UniversalTagInputComponent, MilestoneSelectorComponent],
  templateUrl: './archiv-express-component.html',
  styleUrl: './archiv-express-component.css'
})
export class ArchivExpressComponent {
  private todoService = inject(TodoService);
  private userService = inject(UserService);

  // Signals für die Formular-Zustände
  public milestoneId = signal<string | null>(null);
  protected expressTask = signal<string>('');
  protected expressDescription = signal<string>('');
  protected expressCategory = signal<string>('Allgemein');

  // 🎛️ Counter-Steuerung
  protected isCustomMode = signal<boolean>(false);
  protected effortValues: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected expressUsedEffort = signal<number>(1);

  // 🔌 ViewChild falls wir mal direkten Zugriff auf den UniversalInput brauchen
  @ViewChild(UniversalTagInputComponent) categoryInput!: UniversalTagInputComponent;

public onMilestoneSelected(id: string | null): void {
  console.log('Express-Erfassung: Meilenstein gewechselt auf', id);
  this.milestoneId.set(id);
}
  public onCategoryChanged(category: string): void {
    this.expressCategory.set(category);
  }

  // Counter Actions
  public selectStandardEffort(value: number): void {
    this.isCustomMode.set(false);
    this.expressUsedEffort.set(value);
  }

  public activateCustomMode(): void {
    this.isCustomMode.set(true);
    if (this.expressUsedEffort() <= 10) {
      this.expressUsedEffort.set(11); // Unser logischer Zähl-Startwert!
    }
  }

  public increaseEffort(): void {
    this.expressUsedEffort.update(val => val + 1);
  }

  public decreaseEffort(): void {
    if (this.expressUsedEffort() > 11) {
      this.expressUsedEffort.update(val => val - 1);
    } else {
      this.isCustomMode.set(false);
      this.expressUsedEffort.set(10);
    }
  }

  public resetToStandard(): void {
    this.isCustomMode.set(false);
    this.expressUsedEffort.set(1);
  }

  public submitExpressTodo(): void {
    if (!this.expressTask().trim()) return;

    const currentUserId = this.userService.currentUser()?.id || 'default-user';

    // To-Do Objekt schmieden
    const expressTodo = new Todo({
      task: this.expressTask(),
      description: this.expressDescription() || null,
      effort: this.expressUsedEffort(),     // Geplant = Used für die Vergangenheit!
      usedEffort: this.expressUsedEffort(),
      dueDate: Date.now(), 
      userId: currentUserId,
      milestoneId: this.milestoneId(),
      isStarted: true
    });

    expressTodo.done = true;
    expressTodo.completedAt = Date.now();
    expressTodo.category = this.expressCategory() || 'Allgemein';

    // Ab in den Service feuern
    const todo = this.todoService.createTodo(expressTodo); 
    this.todoService.addDoneTodo(todo);
    
    // Formular wieder blitzblank zurücksetzen
    this.expressTask.set('');
    this.expressDescription.set('');
    this.expressUsedEffort.set(1);
    this.milestoneId.set(null);
    this.expressCategory.set('Allgemein');
    this.isCustomMode.set(false);
  }
}