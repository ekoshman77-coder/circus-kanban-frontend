import { Component, inject, Input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../services/todo/todo-service';
import { futureDateValidator } from '../../../validators/future-date-validator';
import { UniversalTagInputComponent } from '../universal-tag-input-component/universal-tag-input-component';
import { MilestoneSelectorComponent } from '../milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-todo-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, UniversalTagInputComponent, MilestoneSelectorComponent],
  templateUrl: './todo-form.html',
  styleUrl: './todo-form.css'
})
export class TodoFormComponent {
  public isEmbeddedInMilestone = signal<boolean>(false);
  @Input() set forcedMilestoneId(id: string | null | undefined) {
    if (id) {
      this.newMilestoneId.set(id);
      this.isEmbeddedInMilestone.set(true)
    }
  }

  private todoService = inject(TodoService);

  public fibonacciSequence: number[];
  
  // Startet absolut clean und leer
  public newTodoCategory = signal<string>('');
  public newMilestoneId = signal<string | null>(null);

  public todoForm = new FormGroup({
    task: new FormControl('', [Validators.required, Validators.minLength(3)]),
    description: new FormControl(''),
    effort: new FormControl(1, [Validators.required]),
    dueDate: new FormControl('', [Validators.required, futureDateValidator()])
  });

  constructor() {
    this.fibonacciSequence = this.todoService.fibonacciSequence;
  }

  public onSubmit(): void {
    this.addTodo();
  }

  public onCategoryChanged(category: string): void {
    this.newTodoCategory.set(category);
  }

  public addTodo(): void {
    if (this.todoForm.valid) {
      const finalCategory = this.newTodoCategory().trim();
      const dateValue = this.todoForm.value.dueDate as string;
      const timestamp = new Date(dateValue).getTime();
      const milestone = this.newMilestoneId()
      

      this.todoService.createAndAddTodo({
         task: this.todoForm.value.task!,
         description: this.todoForm.value.description || '',
         effort: this.todoForm.value.effort!,
         dueDate: timestamp,
         category: finalCategory,
         milestoneId: milestone?? undefined,
         isStarted: false
      });

      // Formular zurücksetzen
      this.todoForm.reset({
        task: '',
        description: '',
        effort: 1, 
        dueDate: ''
      });
      if (! this.isEmbeddedInMilestone()) {
        this.newMilestoneId.set("")
      }

      // Signal leeren
      this.newTodoCategory.set(''); 
    }
  }
  
  get taskControl() { return this.todoForm.get('task'); }
  get dueDateControl() { return this.todoForm.get('dueDate'); }

  // 👑 DER LEGENDÄRE TRICK: Kalender reaktiv wieder aufreißen!
  public onDateChange(inputElement: HTMLInputElement): void {
    setTimeout(() => {
      // Wenn der Validator 'dateInPast' (Datum in Vergangenheit) meldet, 
      // zwingen wir den Kalender sofort wieder auf!
      if (this.dueDateControl?.hasError('dateInPast')) {
        inputElement.showPicker();
      }
      
      // Sicherheits-Reset falls das Feld komplett gelöscht wurde
      if (!inputElement.value && this.dueDateControl) {
        this.dueDateControl.setValue('');
        this.dueDateControl.markAsTouched();
      }
    }, 50);
  }

  public onMilestoneSelected(milestoneId: string | null) {
    this.newMilestoneId.set(milestoneId)    
  }
}