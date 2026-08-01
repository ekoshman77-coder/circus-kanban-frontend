import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TodoService } from '../../../core/services/todo/todo-service';
import { Todo } from '../../../core/models/todo';
// 🌟 NEU: Der richtige Universal-Input Import
import { UniversalTagInputComponent } from '../../../core/shared/components/universal-tag-input-component/universal-tag-input-component';
import { ConnectionService } from '../../../core/services/connection/connection-service';
import { NavigationHistoryService } from '../../../core/services/navigation/navigation-history-service';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-todo-edit',
  standalone: true,
  // 🌟 NEU: UniversalTagInputComponent statt TaskCategoryComponent geladen
  imports: [CommonModule, ReactiveFormsModule, UniversalTagInputComponent, MilestoneSelectorComponent],
  templateUrl: './todo-edit-component.html',
  styleUrl: './todo-edit-component.css'
})
export class TodoEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  protected todoService = inject(TodoService);
  protected connectionService = inject(ConnectionService)
  private navigationHistoryService = inject(NavigationHistoryService)

  public milestoneId = signal<string | null>(null)

  todoForm!: FormGroup;
  private currentTodo!: Todo;
  
  // Signal für die editierte Kategorie (wird in ngOnInit befüllt)
  public editTodoCategory = signal<string>('');

  isOffline = computed(() => {
      return this.connectionService.isOffline()
  })

  liquidDateLabel = signal<string>('Heute');
  sliderDays = signal<number>(0);
  sliderPercentage = signal<number>(0);
  sliderHue = signal<number>(120);

  dynamicColor = computed(() => {
    return `hsl(${this.sliderHue()}, 85%, 40%)`;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const todo = this.todoService.getTodoById(id)
      if (todo) {
        this.currentTodo = todo;
        this.milestoneId.set(todo.milestoneId)
        // 🌟 Signal direkt mit der bestehenden Kategorie des To-Dos initialisieren
        this.editTodoCategory.set(todo.category || '');

        const targetDate = new Date(todo.dueDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        targetDate.setHours(0,0,0,0);

        const diffTime = targetDate.getTime() - today.getTime();
        let daysAhead = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysAhead < 0) daysAhead = 0;
        if (daysAhead > 30) daysAhead = 30;

        this.sliderDays.set(daysAhead);
        this.updateDateLabel(daysAhead);
        this.calculateSliderMetrics(daysAhead);

        this.todoForm = this.fb.group({
          task: [todo.task, [Validators.required, Validators.minLength(3)]],
          description: [todo.description],
          effort: [todo.effort, [Validators.required]],
          daysAhead: [daysAhead, [Validators.required]]
        });
      } else {
        this.cancel();
      }
    } else {
      this.cancel();
    }
  };

  private calculateSliderMetrics(days: number): void {
    const percent = (days / 30) * 100;
    this.sliderPercentage.set(percent);
    
    let hue = percent * 1.2; 
    hue = Math.max(Math.min(hue, 120), 0);
    this.sliderHue.set(hue);
  }

  public onSliderInput(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.calculateSliderMetrics(value);
    const days = Math.round(value);
    this.sliderDays.set(days); 
    this.updateDateLabel(days);
  }

  private updateDateLabel(days: number): void {
    if (days === 0) {
      this.liquidDateLabel.set('Heute fällig! 🚨');
    } else if (days === 1) {
      this.liquidDateLabel.set('Morgen fällig! ⏳');
    } else if (days === 2) {
      this.liquidDateLabel.set('Übermorgen fällig! 🗓️');
    } else {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
      this.liquidDateLabel.set(`In ${days} Tagen (${targetDate.toLocaleDateString('de-DE', options)}) 📅`);
    }
  }

  public onCategoryChanged(newCategory: string): void {
    this.editTodoCategory.set(newCategory);
  }

  cancel(): void {
    this.navigationHistoryService.back('/');
  }

  save(): void {
    if (this.todoForm.invalid) return;

    const formValues = this.todoForm.value;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + formValues.daysAhead);
    targetDate.setHours(23, 59, 59, 999);

    this.currentTodo.task = formValues.task;
    this.currentTodo.description = formValues.description;
    this.currentTodo.effort = formValues.effort;
    this.currentTodo.dueDate = targetDate.getTime();
    
    // 🌟 Hier wird der aktualisierte Wert aus dem Signal sauber abgespeichert
    this.currentTodo.category = this.editTodoCategory().trim();
    this.currentTodo.milestoneId = this.milestoneId()

    this.todoService.updateTodo(this.currentTodo);
    this.navigationHistoryService.back('/');
  }

  public onMilestoneSelected(id: string | null) {
      this.milestoneId.set(id)
  }
}