import { Component, Input, Output, EventEmitter, signal, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../services/todo/todo-service';
import { Router } from '@angular/router';
import { ConnectionService } from '../../../services/connection-service';
import { TodoViewModel } from '../../../viewmodel/todo-view-model';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { TeamService } from '../../../services/team-service';
import { UserModel } from '../../../models/user-model';
import { Todo } from '../../../models/todo';

@Component({
  selector: 'app-todo-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './todo-item-component.html',
  styleUrl: './todo-item-component.css',
  animations: [
    trigger('fadeSlide', [
      // :enter -> Wenn das Element neu auf den Bildschirm kommt
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)', height: '0px' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)', height: '*' }))
      ]),
      // :leave -> Wenn das Element gelöscht oder aus der Liste entfernt wird
      transition(':leave', [
        animate('250ms ease-in', style({ opacity: 0, transform: 'translateY(10px)', height: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }))
      ])
    ])
  ]
})
export class TodoItemComponent {
  protected todoService = inject(TodoService)
  private connectionService = inject(ConnectionService)
  public teamService = inject(TeamService);
  private router = inject(Router)

  item = input.required<TodoViewModel>();

  @Input() isDescriptionOpen: boolean = false;
  @Input() isKanbanMode: boolean = false;
  public isTeamsPopupEnabled = input<boolean>(false);
  public assignableUsers = input<UserModel[]>([]);

  @Output() toggleDescription = new EventEmitter<void>();
  @Output() toggleComplete = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();


  isEditingPoints = signal<boolean>(false);
  protected isOffline = computed(() => this.connectionService.isOffline());
  public isPopupOpen = computed(() => this.item().showEffortPopup());

  // 👥 Der aktuell zugewiesene Benutzer
  // 👥 Der aktuell zugewiesene Benutzer
  public assignedUser = computed<UserModel | null>(() => {
    const todo = this.item()?.todo;
    const assignedId = todo?.assignedUserId;
    if (!assignedId) return null;

    // Wir holen uns die globalen TeamMitglieder und ziehen das .user Model heraus
    const members = this.teamService.globalMembersSignal();
    const foundMember = members.find(m => m.user.id === assignedId);
    return foundMember ? foundMember.user : null;
  });

  // 🧠 Der vorherige Entwickler (aus dem Ticket-Gedächtnis)
  public lastDeveloperUser = computed<UserModel | null>(() => {
    const todo = this.item()?.todo;
    const lastDevId = todo?.lastDeveloperId;
    if (!lastDevId) return null;

    // Auch hier mappen wir über das .user Model
    const members = this.teamService.globalMembersSignal();
    const foundMember = members.find(m => m.user.id === lastDevId);
    return foundMember ? foundMember.user : null;
  });

  selectPoints(newPoints: number) {
    if (this.isOffline()) return;
    const currentTodo = this.item();

    // Nur anstoßen, wenn das To-Do wirklich offen ist
    if (!currentTodo.todo.done && currentTodo.effort > 0) {
      this.todoService.updateTodoEffort(currentTodo.id, newPoints);
    }

    // Auswahlfenster schließen
    this.isEditingPoints.set(false);
  }

  onEditClick() {
    this.router.navigate(['/todopage/edit', this.item().id])
  }

  // onCheckToggle() fliegt raus! ❌

  /**
   * 🛡️ Kontrollierter Klick auf die Checkbox
   */
  public onCheckClick(event: MouseEvent): void {
    // 1. Dem Browser verbieten, den Haken eigenmächtig zu setzen/löschen!
    event.preventDefault();

    // 2. Die Entscheidung komplett an das ViewModel übergeben
    this.item().onTodoChecked(this.todoService);
  }

  // 2. HIER IST DEINE MEHTODE: Die Brücke zum ViewModel!
  public onEffortConfirmed(actualEffort: number): void {
    // 🌟 WICHTIG: Über 'this.item' rufst du die Logik des ViewModels auf!
    if (!this.item().canEdit) {
      console.warn("⚠️ Aktion verweigert: Du darfst die Story Points dieses Todos nicht ändern!");
      return;
    }
    this.item().onEffortConfirmed(actualEffort, this.todoService);

    // Lokales Popup wieder schließen
    //    this.isPopupOpen.set(false);
  }

  public cancelEffortPopup() {
    this.item().cancelEffortPopup()
  }

  /**
 * Wird aufgerufen, wenn im eingebetteten Popup ein Mitarbeiter ausgewählt wird!
 */
public onAssigneeSelected(userId: string | null): void {
    const currentTodo = this.item()?.todo;
    if (!currentTodo) return;

    // 1. Eine saubere Kopie des aktuellen Todos erstellen
    const updatedTodo = Todo.fromTodo(currentTodo);
    
    // 2. Die neue Zuweisung eintragen (oder null, falls gelöscht wird)
    updatedTodo.assignedUserId = userId;

    console.log(`👥 [Zuweisung] Todo '${updatedTodo.task}' wird an '${userId}' zugewiesen.`);

    // 3. Das Update an den TodoService (und damit an Spring Boot!) übergeben
    this.todoService.updateTodo(updatedTodo, true);

    // 4. Das Popup reaktiv über das ViewModel wieder schließen
    this.item().showAssigneePopup.set(false);
  }
  
  public toggleAssigneePopup(event: MouseEvent): void {
    event.stopPropagation(); // Verhindert das Öffnen der Todo-Details
    
    // Wenn die Zuweisung gesperrt ist, machen wir gar nichts!
    if (!this.isAssigneeEditable()) {
      console.warn("🔒 Zuweisung in diesem Spalten-Zustand nicht erlaubt.");
      return;
    }
    
    if (this.item()) {
      const currentState = this.item().showAssigneePopup();
      this.item().showAssigneePopup.set(!currentState);
    }
  }

  // 🔒 Bestimmt, ob die Zuweisung in diesem Status manuell geändert werden darf!
  public isAssigneeEditable = computed<boolean>(() => {
    const todo = this.item()?.todo;
    if (!todo) return false;
    
    // Nur in Bearbeitung und im Review ist die Zuweisung editierbar!
    return todo.teamStatus === 'IN_PROGRESS' || todo.teamStatus === 'REVIEW';
  });
}