import { Component, Input, Output, EventEmitter, signal, inject, computed, input, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../../services/todo/todo-service';
import { Router } from '@angular/router';
import { ConnectionService } from '../../../services/connection/connection-service';
import { TodoViewModel } from '../../../viewmodel/todo-view-model';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { TeamService } from '../../../services/team/team-service';
import { UserModel } from '../../../models/user-model';
import { Todo } from '../../../models/todo';
import { UserService } from '../../../services/user/user-service';
import { EffortModalComponent } from '../effort-modal-component/effort-modal-component';

@Component({
  selector: 'app-todo-item',
  standalone: true,
  imports: [CommonModule, FormsModule, EffortModalComponent],
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
  protected todoService = inject(TodoService);
  private connectionService = inject(ConnectionService);
  public teamService = inject(TeamService);
  private userService = inject(UserService);
  private router = inject(Router);
  public elementRef = inject(ElementRef);

  // 🎯 Greift das Element #checkLabel aus dem Template
  @ViewChild('checkLabel', { static: false }) checkLabelRef?: ElementRef;

  item = input.required<TodoViewModel>();

  @Input() isDescriptionOpen: boolean = false;
  @Input() isKanbanMode: boolean = true;
  public isTeamsPopupEnabled = input<boolean>(false);
  public assignableUsers = input<UserModel[]>([]);

  @Output() toggleDescription = new EventEmitter<void>();
  @Output() toggleComplete = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() reviewTriggered = new EventEmitter<Todo>();

  isEditingPoints = signal<boolean>(false);
  protected isOffline = computed(() => this.connectionService.isOffline());
  public isPopupOpen = computed(() => this.item().showEffortPopup());

  public assignedUser = computed<UserModel | null>(() => {
    const todo = this.item()?.todo;
    const assignedId = todo?.assignedUserId;
    if (!assignedId) return null;

    const members = this.teamService.globalMembersSignal();
    const foundMember = members.find(m => m.user.id === assignedId);
    return foundMember ? foundMember.user : null;
  });

  public lastDeveloperUser = computed<UserModel | null>(() => {
    const todo = this.item()?.todo;
    const lastDevId = todo?.lastDeveloperId;
    if (!lastDevId) return null;

    const members = this.teamService.globalMembersSignal();
    const foundMember = members.find(m => m.user.id === lastDevId);
    return foundMember ? foundMember.user : null;
  });

  selectPoints(newPoints: number) {
    if (this.isOffline()) return;
    const currentTodo = this.item();

    if (!currentTodo.todo.done && currentTodo.effort > 0) {
      this.todoService.updateTodoEffort(currentTodo.id, newPoints);
    }

    this.isEditingPoints.set(false);
  }

  onEditClick() {
    this.router.navigate(['/todopage/edit', this.item().id]);
  }

  public onCheckClick(event: MouseEvent): void {
    event.preventDefault();

    this.item().onTodoChecked(
      this.todoService, 
      this.userService.getCurrentUserId() ?? "",
      (updatedTodo) => {
        this.reviewTriggered.emit(updatedTodo);
      }
    );
  }

  public onEffortConfirmed(devEffort: number, reviewerEffort: number): void {
    if (!this.item().canEdit) {
      console.warn("⚠️ Keine Berechtigung!");
      return;
    }
    this.item().onEffortConfirmed(devEffort, reviewerEffort, this.todoService);
  }

  public onDropdownChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const newValue = Number(selectElement.value);

    if (!isNaN(newValue)) {
      this.selectPoints(newValue);
    } else {
      this.isEditingPoints.set(false);
    }
  }

  public cancelEffortPopup() {
    this.item().cancelEffortPopup();
  }

  public onAssigneeSelected(userId: string | null): void {
    const currentTodo = this.item()?.todo;
    if (!currentTodo) return;

    const updatedTodo = Todo.fromTodo(currentTodo);
    updatedTodo.assignedUserId = userId;

    if (updatedTodo.teamStatus === 'REVIEW') {
       updatedTodo.reviewerId = userId;
    }
    console.log('onAssigneeSelected', updatedTodo)
    
    this.todoService.updateTodo(updatedTodo, true);
    this.item().showAssigneePopup.set(false);
  }

  public toggleAssigneePopup(event: MouseEvent): void {
    event.stopPropagation();

    if (!this.isAssigneeEditable()) {
      return;
    }

    if (this.item()) {
      const currentState = this.item().showAssigneePopup();
      this.item().showAssigneePopup.set(!currentState);
    }
  }

  public isAssigneeEditable = computed<boolean>(() => {
    const todo = this.item()?.todo;
    if (!todo) return false;

    return todo.teamStatus === 'IN_PROGRESS' || todo.teamStatus === 'REVIEW';
  });
}