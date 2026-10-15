import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop'; // 👈 CDK Drag & Drop
import { AdminTodoService } from '../../../../core/services/admin/todos/admin-todo-service';
import { ConnectionService } from '../../../../core/services/connection/connection-service';
import { AdminTodoFilter } from '../../../../core/repositories/dto/admin-todo-filter';
import { Todo } from '../../../../core/models/todo';
import { UserService } from '../../../../core/services/user/user-service';
import { UserModel } from '../../../../core/models/user-model';
import { AdminTeamService } from '../../../../core/services/admin/admin-team-service';

@Component({
  selector: 'app-admin-todo-board-component',
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './admin-todo-board-component.html',
  styleUrl: './admin-todo-board-component.css',
})
export class AdminTodoBoardComponent {
  private adminTodoService = inject(AdminTodoService);
  private connectionService = inject(ConnectionService);
  private adminTeamService = inject(AdminTeamService);

  private expandedTodoId = signal<string | null>(null);

  public selectedDepartmentId = '';
  public selectedProjectId = '';
  public selectedTargetUserId = '';
  public isArchived = false;

  public isOnline = this.connectionService.isOnline;
  public isLoading = this.adminTodoService.isLoading;
  public todos = this.adminTodoService.rawAdminTodos;

  public departmentOptions = this.adminTodoService.departmentOptions;
  public projectOptions = this.adminTodoService.projectOptions;
  public userOptions = this.adminTodoService.userOptions;

  public hasActiveFilter = computed(() => {
    const filter = this.adminTodoService.activeFilter();
    return !!(filter && (filter.projectId || filter.targetUserId || filter.isArchived || filter.departmentId));
  });

  public onFilterChange(): void {
    const filter: AdminTodoFilter = {
      departmentId: this.selectedDepartmentId || undefined,
      projectId: this.selectedProjectId || undefined,
      targetUserId: this.selectedTargetUserId || undefined,
      isArchived: this.isArchived
    };

    this.adminTodoService.applyFilter(filter);
  }

  /**
   * 🎯 Event beim Reindroppen einer Karte in die Trash-Zone
   */
  public onDropInTrash(event: CdkDragDrop<any>): void {
    const draggedTodo = event.item.data as Todo;
    if (!draggedTodo) return;

    if (this.isArchived) {
      // Grün-Modus: Aus dem Archiv holen
      this.adminTodoService.restoreTodo(draggedTodo.id);
    } else {
      // Rot-Modus: In das Archiv werfen (Soft-Delete)
      this.adminTodoService.archiveTodo(draggedTodo.id);
    }
  }

  public getUserForTodo(userId: string): UserModel | null {
    return this.adminTeamService.getUserById(userId) 
  }

  public isTodoExpanded(todoId: string): boolean {
    return this.expandedTodoId() === todoId;
  }

  public toggleDescription(todoId: string): void {
    if (this.isTodoExpanded(todoId)) {
      // Wenn es schon offen ist -> zuklappen
      this.expandedTodoId.set(null);
    } else {
      // Andernfalls öffnen (und das eventuell vorherige automatisch schließen!)
      this.expandedTodoId.set(todoId);
    }
  }
}