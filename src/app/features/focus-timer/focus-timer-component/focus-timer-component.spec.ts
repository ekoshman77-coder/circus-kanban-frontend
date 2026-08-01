import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FocusTimerComponent } from './focus-timer-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { FocusDataManagerService } from '../../../core/services/focus/focus-data-manager-service';
import { of } from 'rxjs';
import { Todo } from '../../../core/models/todo';
import { signal } from '@angular/core';

describe('FocusTimerComponent', () => {
  let component: FocusTimerComponent;
  let fixture: ComponentFixture<FocusTimerComponent>;
  
  // 1. Mocks für die Services vorbereiten
  let todoServiceMock: any;
  let focusDataManagerMock: any;

  // Ein Test-Todo, das wir für die Auswahl benutzen
  const mockTodo: Todo = { id: 'todo_abc', task: 'Unit Tests schreiben', done: false } as any;

beforeEach(() => {
  todoServiceMock = {
    openTodosOnly: signal<Todo[]>([mockTodo])
  };

  focusDataManagerMock = {
    recordCompletedPomodoro: vi.fn().mockReturnValue(of(true))
  };

  TestBed.configureTestingModule({
    imports: [FocusTimerComponent],
    providers: [
      { provide: TodoService, useValue: todoServiceMock },
      { provide: FocusDataManagerService, useValue: focusDataManagerMock },
      // 🔥 DAS HIER SCHALTET DIE SCHULDIGE ZONE AUS:
    ]
  });

  fixture = TestBed.createComponent(FocusTimerComponent);
  component = fixture.componentInstance;
  fixture.detectChanges();
});

  // --- HIER STARTEN DEINE TESTFÄLLE ---

  // Test 1: Start ohne To-Do verhindern
  it('should not start the timer if no todo is selected', () => {
    expect(component['selectedTodo']()).toBeNull();
    
    // Wir versuchen den Timer zu starten
    component['toggleTimer']();
    
    // Er darf nicht laufen!
    expect(component['isRunning']()).toBe(false);
  });

  // Test 2: Timer läuft los (Wir nutzen fakeAsync/tick für die Zeit-Simulation!)
  it('should countdown when timer is started with a selected todo', () => {
    vi.useFakeTimers();
    // To-Do auswählen
    component['selectedTodo'].set(mockTodo);
    
    // Timer starten
    component['toggleTimer']();
    expect(component['isRunning']()).toBe(true);

    // Wir simulieren das Vergehen von 3 Sekunden im Test
    vi.advanceTimersByTime(3000);

    // Nach 3 Sekunden muss die verbleibende Zeit um 3 geschrumpft sein (15 - 3 = 12)
    expect(component['totalSecondsLeft']()).toBe(1497);

    // Wichtig: Timer stoppen, damit das Intervall im Hintergrund nicht ewig weiterläuft!
    component['toggleTimer']();
    vi.useRealTimers();
  });

  // Test 3: Pause stoppt den Timer
  it('should pause the countdown when toggleTimer is called again', () => {
    vi.useFakeTimers();
    component['selectedTodo'].set(mockTodo);
    
    component['toggleTimer'](); // Start
    vi.advanceTimersByTime(2000);
    expect(component['totalSecondsLeft']()).toBe(1498);

    component['toggleTimer'](); // Pause
    expect(component['isRunning']()).toBe(false);

    vi.advanceTimersByTime(5000); // Wir warten noch mal 5 Sekunden im "pausierten" Zustand
    
    // Die Zeit darf sich NICHT verändert haben, weil Pause aktiv ist!
    expect(component['totalSecondsLeft']()).toBe(1498);
    vi.useRealTimers();

  });

  // Test 4: Zurücksetzen (Reset)
  it('should reset the timer to default time when resetTimer is called', () => {
    vi.useFakeTimers()
    component['selectedTodo'].set(mockTodo);
    
    component['toggleTimer']();
    vi.advanceTimersByTime(10000); // Zeit runterlaufen lassen auf 10
    expect(component['totalSecondsLeft']()).toBe(1490);

    component['toggleTimer'](); // Stoppen (da resetTimer im echten Code [disabled]="isRunning" hat)
    component['resetTimer']();

    // Muss wieder auf der Standardzeit (15 Sekunden) stehen!
    expect(component['totalSecondsLeft']()).toBe(1500);
    vi.useRealTimers()
  });

  // Test 5: Ablauf schickt Ticket an DataManager
it('should trigger FocusDataManager and show celebration when timer reaches 0', () => {
  vi.useFakeTimers();
  component['selectedTodo'].set(mockTodo);
  
  component['toggleTimer'](); // Start bei 1500 Sekunden
  
  // Wir spulen die vollen 25 Minuten (1500 Sekunden) in Millisekunden vor!
  // 1500 * 1000 = 1500000 ms
  vi.advanceTimersByTime(1500000); 
  vi.advanceTimersByTime(1000);
  fixture.detectChanges();
  // A) Wurde die Server-Methode mit der richtigen Todo-ID aufgerufen?
  expect(focusDataManagerMock.recordCompletedPomodoro).toHaveBeenCalledWith('todo_abc');

  // B) Wurde das Erfolgs-Popup im Signal aktiviert?
  expect(component['showSuccessCelebration']()).toBe(true);
  
  // C) Ist der Timer danach automatisch wieder auf den Startwert zurückgesprungen?
  expect(component['totalSecondsLeft']()).toBe(1500);

  vi.useRealTimers();
  });
});