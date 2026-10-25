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
import { SensitiveTextEditorComponent } from '../../../../core/shared/components/sensitive-text-editor/sensitive-text-editor-component/sensitive-text-editor-component';
import { CreatePatternFromSelectionDto } from '../../../../core/repositories/dto/create-pattern-from-selection';

@Component({
  selector: 'app-admin-todo-board-component',
  imports: [CommonModule, FormsModule, DragDropModule, SensitiveTextEditorComponent],
  templateUrl: './admin-todo-board-component.html',
  styleUrl: './admin-todo-board-component.css',
})
export class AdminTodoBoardComponent {
  private adminTodoService = inject(AdminTodoService);
  private connectionService = inject(ConnectionService);
  private adminTeamService = inject(AdminTeamService);

  private expandedTodoId = signal<string | null>(null);

// 1. Wir speichern im Modal nur noch die ID des aktuell geöffneten To-Dos
  private activeTodoIdForSanitization = signal<string | null>(null);

  // 2. Ein Computed Signal sucht automatisch immer das passende, frische Todo aus der aktuellen todos()-Liste!
  public activeTodoForSanitization = computed(() => {
    const id = this.activeTodoIdForSanitization();
    if (!id) return null;
    // Sobald sich `todos()` durch den Server-Fetch ändert, liefert dieses computed() 
    // sofort das brandneue Todo-Objekt mit den aktualisierten sensitiveMatches zurück!
    return this.todos().find(t => t.id === id) || null;
  });

  public selectedDepartmentId = '';
  public selectedProjectId = '';
  public selectedTargetUserId = '';
  public isArchived = false;
  public onlySensitive = false;

  public isOnline = this.connectionService.isOnline;
  public isLoading = this.adminTodoService.isLoading;
  public todos = this.adminTodoService.rawAdminTodos;

  public departmentOptions = this.adminTodoService.departmentOptions;
  public projectOptions = this.adminTodoService.projectOptions;
  public userOptions = this.adminTodoService.userOptions;

  public hasActiveFilter = computed(() =>  this.adminTodoService.activeFilter()?.isValid());

  public onFilterChange(): void {
    const filter: AdminTodoFilter = new AdminTodoFilter({
      departmentId: this.selectedDepartmentId || undefined,
      projectId: this.selectedProjectId || undefined,
      targetUserId: this.selectedTargetUserId || undefined,
      isArchived: this.isArchived,
      onlySensitive: this.onlySensitive
    });

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

  public sanitizeTodoDescription(todoId: string, event: MouseEvent): void {
    event.stopPropagation(); // Verhindert, dass sich die Karte komisch verhält
    
    // Wir rufen später unseren DataManager auf
    this.adminTodoService.sanitizeTodo(todoId);
  }

  // 🧼 Modal öffnen
  public openSanitizeModal(todo: Todo, event: MouseEvent): void {
    event.stopPropagation();
    this.activeTodoIdForSanitization.set(todo.id);
  }

  // ❌ Modal schließen
  public closeSanitizeModal(): void {
    this.activeTodoIdForSanitization.set(null);
  }

  // 💾 Speichern der Entscheidungen aus dem Editor
  public onSanitizationFinished(feedbackMap: Map<string, boolean | null>): void {
    const activeTodo = this.activeTodoForSanitization();
    if (activeTodo) {
      this.adminTodoService.saveSanitizationFeedback(activeTodo.id, activeTodo.sensitiveMatches, feedbackMap);
    }
    this.closeSanitizeModal();
  }

public onCreateNewPattern(dto: CreatePatternFromSelectionDto): void {
    console.log('✅ Neues Muster erstellt. Lade Todos neu und aktualisiere aktives Modal...');
    
    // 1. Wir merken uns die ID des aktuell im Modal geöffneten Todos
    const currentActiveId = this.activeTodoForSanitization()?.id;

    // 2. Wir triggern den Filter-Reload (holt die Daten vom Server)
    this.onFilterChange();

    // 3. Sobald die neuen Todos da sind, aktualisieren wir das Modal-Objekt sofort mit den frischen Server-Daten!
    if (currentActiveId) {
      // Kleine Verzögerung oder direkter Lookup im aktuellen todos()-Signal
      const updatedTodo = this.todos().find(t => t.id === currentActiveId);
      if (updatedTodo) {
        this.activeTodoIdForSanitization.set(updatedTodo.id);
        console.log('🔄 Modal mit frischen Server-Daten aktualisiert. Neue Matches:', updatedTodo.sensitiveMatches?.length);
      }
    }
  }
}