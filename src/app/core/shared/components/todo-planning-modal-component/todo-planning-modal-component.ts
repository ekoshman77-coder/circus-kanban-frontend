import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TodoService } from '../../../services/todo/todo-service';
import { CommonModule } from '@angular/common';
import { UniversalTagInputComponent } from '../universal-tag-input-component/universal-tag-input-component';
import { MilestoneSelectorComponent } from '../milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-todo-planning-modal-component',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, UniversalTagInputComponent, MilestoneSelectorComponent],
  templateUrl: './todo-planning-modal-component.html',
  styleUrl: './todo-planning-modal-component.css',
})
export class TodoPlanningModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private todoService = inject(TodoService);

  // Inputs & Outputs für die Kommunikation mit dem Board
  initialTaskName = input<string>('');
  initialDescription = input<string>('');
  initialCategory = input<string>('');
  currentMilestoneId = input<string | null>(null);

  closeModal = output<void>();
  todoPlanned = output<void>();

  // Das schlanke Formular – Validierung nur für den Titel!
  planningForm: FormGroup = this.fb.group({
    task: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    effort: [1],
    milestoneId: ['']
  });

  // Signal für die KI-Kategorie
  selectedCategory = signal<string>('');

  // 🎛️ DEINE FUNNY-SLIDER-SIGNALE
 public liquidDateLabel = computed(() => {
  const days = this.sliderDays();
  
  if (days === 0) {
    return 'Heute fällig! 🚨';
  } else if (days === 1) {
    return 'Morgen fällig! ⏳';
  } else if (days === 2) {
    return 'Übermorgen fällig! 🗓️';
  } else {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `In ${days} Tagen (${targetDate.toLocaleDateString('de-DE', options)}) 📅`;
  }
});

sliderDays = signal<number>(0);

public sliderPercentage = computed(() => {
  const days = this.sliderDays() || 0; // Fallback auf 0, falls mal undefined
  const max = 30;
  return Math.min(Math.max((days / max) * 100, 0), 100); // Garantiert zwischen 0% und 100%
});

  public sliderHue = computed(() => {
  const days = this.sliderDays() || 0;
  const percent = (days / 30) * 100;
  let hue = percent * 1.2;
  return Math.max(Math.min(hue, 120), 0);
  });

  public fibonacciSequence = [1, 2, 3, 5, 8, 13, 21];

  dynamicColor = computed(() => {
    return `hsl(${this.sliderHue()}, 85%, 40%)`;
  });

  ngOnInit(): void {
    console.log("TodoPlanningModal:: onOnInit MilestoneId = ", this.currentMilestoneId())
    this.planningForm.patchValue({
      task: this.initialTaskName(),
      description: this.initialDescription(),
      milestoneId: this.currentMilestoneId() || '' // Falls ein Meilenstein aktiv übergeben wurde
    });

    this.selectedCategory.set(this.initialCategory() || 'Idee');
    this.sliderDays.set(0);
  }

public onSliderInput(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value);
  this.sliderDays.set(Math.round(value));
}

  public onCategoryChanged(category: string): void {
    this.selectedCategory.set(category);
  }

  public onMilestoneSelected(milestoneId: string): void {
    this.planningForm.patchValue({ milestoneId });
  }

  public cancel(): void {
    this.planningForm.reset({ task: '', description: '', effort: 1 });
    this.closeModal.emit();
  }

  public submitPlan(): void {
    if (this.planningForm.invalid) return;

    const values = this.planningForm.value;

    // Fälligkeit aus dem Slider berechnen
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + this.sliderDays());
    targetDate.setHours(23, 59, 59, 999);

    // Automatisches Einsortieren ins Backlog!
    this.todoService.createAndAddTodo({
      task: values.task,
      description: values.description || '',
      effort: values.effort,
      dueDate: targetDate.getTime(),
      category: this.selectedCategory(),
      milestoneId: values.milestoneId || this.currentMilestoneId() || undefined,
      isStarted: false // Backlog-Karten starten immer unberührt
    });

    this.planningForm.reset({ task: '', description: '', effort: 1 });
    this.todoPlanned.emit();
  }
}