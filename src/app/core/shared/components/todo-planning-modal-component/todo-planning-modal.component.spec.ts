import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TodoPlanningModalComponent } from './todo-planning-modal-component';
import { TodoService } from '../../../services/todo/todo-service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('TodoPlanningModalComponent 🎪', () => {
  let component: TodoPlanningModalComponent;
  let fixture: ComponentFixture<TodoPlanningModalComponent>;

  // Den TodoService präzise mocken
  const mockTodoService = {
    createAndAddTodo: vi.fn()
  };

beforeEach(async () => {
    // 🛡️ GLOBALER STORAGE-SCHUTZWALL: Verhindert den Absturz durch Kindkomponenten
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true
    });

    await TestBed.configureTestingModule({
      imports: [
        TodoPlanningModalComponent, 
        ReactiveFormsModule,
        FormsModule
      ],
      providers: [
        { provide: TodoService, useValue: mockTodoService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TodoPlanningModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    vi.clearAllMocks();
  });

  it('sollte das Planning-Modal erfolgreich erstellen', () => {
    expect(component).toBeTruthy();
  });

  // 📝 TEST-REIHE 1: VALIDIERUNG
  describe('📝 Formular-Validierung', () => {
    it('sollte standardmäßig invalid sein, da der Task-Name leer ist', () => {
      expect(component.planningForm.valid).toBe(false);
      expect(component.planningForm.get('task')?.errors?.['required']).toBeTruthy();
    });

    it('sollte invalid sein, wenn der Task-Name kürzer als 3 Zeichen ist', () => {
      component.planningForm.patchValue({ task: 'Hi' });
      expect(component.planningForm.valid).toBe(false);
      expect(component.planningForm.get('task')?.errors?.['minlength']).toBeTruthy();
    });

    it('sollte valide werden, sobald ein ordentlicher Name eingetragen ist', () => {
      component.planningForm.patchValue({ task: 'Zirkuszelt aufbauen' });
      expect(component.planningForm.valid).toBe(true);
    });
  });

  // 🎛️ TEST-REIHE 2: SLIDER & FLUID DATE LABEL
  describe('🎛️ Funny-Slider & Fälligkeits-Berechnungen', () => {
    it('sollte das passende Label für HEUTE (0 Tage) ausgeben', () => {
      component.sliderDays.set(0);
      fixture.detectChanges();
      expect(component.liquidDateLabel()).toBe('Heute fällig! 🚨');
    });

    it('sollte das passende Label für MORGEN (1 Tag) ausgeben', () => {
      component.sliderDays.set(1);
      fixture.detectChanges();
      expect(component.liquidDateLabel()).toBe('Morgen fällig! ⏳');
    });

    it('sollte den prozentualen Wert für die CSS-Variable exakt berechnen', () => {
      component.sliderDays.set(15); // 15 von 30 Tagen = 50%
      fixture.detectChanges();
      expect(component.sliderPercentage()).toBe(50);
    });
  });

  // 💾 TEST-REIHE 3: SPEICHER-WORKFLOW
  describe('💾 Ticket schmieden & Abspeichern', () => {
    it('sollte beim Submit das Ticket mit berechneter Endzeit ans Backlog übergeben', () => {
      // 1. Formular befüllen
      component.planningForm.patchValue({
        task: 'Popcorn-Maschine ölen',
        description: 'Bitte nur das Spezial-Öl nutzen!',
        effort: 5,
        milestoneId: 'ms-99'
      });
      
      // KI-Kategorie manuell setzen
      component.selectedCategory.set('Küche');
      
      // Slider auf 3 Tage stellen
      component.sliderDays.set(3);

      // Event-Emitter belauschen
      const plannedSpy = vi.spyOn(component.todoPlanned, 'emit');

      // 2. Submit triggern
      component.submitPlan();

      // 3. Überprüfen, ob das errechnete Datum exakt auf 23:59:59 Uhr des Zieltages gesetzt wurde
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 3);
      expectedDate.setHours(23, 59, 59, 999);

      expect(mockTodoService.createAndAddTodo).toHaveBeenCalledWith({
        task: 'Popcorn-Maschine ölen',
        description: 'Bitte nur das Spezial-Öl nutzen!',
        effort: 5,
        dueDate: expectedDate.getTime(), // Geprüft bis auf die Millisekunde!
        category: 'Küche',
        milestoneId: 'ms-99',
        isStarted: false
      });

      // Wurde das Event nach oben gefunkt, um das Modal zu schließen?
      expect(plannedSpy).toHaveBeenCalled();
    });

    it('sollte beim Abbrechen das Formular komplett auf Standardwerte zurücksetzen', () => {
      component.planningForm.patchValue({ task: 'Wird eh gelöscht' });
      const cancelSpy = vi.spyOn(component.closeModal, 'emit');

      component.cancel();

      expect(component.planningForm.get('task')?.value).toBe('');
      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});