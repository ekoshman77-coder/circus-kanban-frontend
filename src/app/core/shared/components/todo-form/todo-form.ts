import { Component, inject, Input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../services/todo/todo-service';
import { futureDateValidator } from '../../../validators/future-date-validator';
import { UniversalTagInputComponent } from '../universal-tag-input-component/universal-tag-input-component';
import { MilestoneSelectorComponent } from '../milestone-selector-component/milestone-selector-component';
import { UniversalPredictorService } from '../../../services/universal-predictor-service';
import { debounceTime, distinctUntilChanged, timeout } from 'rxjs';
import { NotificationService } from '../../../services/notification-service';

@Component({
  selector: 'app-todo-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, UniversalTagInputComponent, MilestoneSelectorComponent],
  templateUrl: './todo-form.html',
  styleUrl: './todo-form.css'
})
export class TodoFormComponent {
  private predictorService = inject(UniversalPredictorService);
  private notificationService = inject(NotificationService)

  private suggestedEffortValue = 0;
  // Signal für die UI-Nachricht der KI
  public aiEffortMessage = signal<string>('');

  public isEmbeddedInMilestone = signal<boolean>(false);
  @Input() set forcedMilestoneId(id: string | null | undefined) {
    if (id) {
      this.newMilestoneId.set(id);
      this.isEmbeddedInMilestone.set(true)
    }
  }

  public layoutMode = signal<'wide' | 'compact'>('wide');

  @Input() set layout(mode: 'wide' | 'compact') {
    if (mode) {
      this.layoutMode.set(mode);
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

    this.todoForm.get('task')?.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(async (text) => {
      if (text && text.trim().length >= 3) {
        // Hol die nackte Zahl vom Service
        const points = await this.predictorService.predictEffort(text);
        
        if (points !== null && points > 0) {
          this.suggestedEffortValue = points;
          
          // 🌍 HIER baut das Frontend den Text! Absolut sauber und neutral.
          // Später kannst du hier auch ein Übersetzungssystem wie ngx-translate dranhängen!
          this.aiEffortMessage.set(`Team-Schnitt: ${points} P`);
        } else {
          this.aiEffortMessage.set('');
        }
      } else {
        this.aiEffortMessage.set('');
      }
    });
  }
  
  // 🪄 Klick-Funktion: Übernimmt den Wert, wenn der User es wünscht!
  public applyAiEffort(): void {
    if (this.suggestedEffortValue > 0) {
      this.todoForm.get('effort')?.setValue(this.suggestedEffortValue);
    }
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