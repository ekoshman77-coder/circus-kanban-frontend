import { inject, Injectable, computed, signal } from '@angular/core';
import { AdminTodoDataManagerService } from './admin-todo-data-manager';
import { BaseDataManager } from '../../abstract-base-data-manager/base-data-manager';
import { DepartmentService } from '../department-service';
import { AdminProjectService } from '../projects/admin-project-service';
import { AdminTeamService } from '../admin-team-service';
import { AdminTodoFilter } from '../../../repositories/dto/admin-todo-filter';
import { SensitiveMatch } from '../../../models/sensitive-match';
import { SanitizationFeedback } from '../../../models/sanitiziation-feedback';

@Injectable({
  providedIn: 'root'
})
export class AdminTodoService extends BaseDataManager {
  sanitizeTodo(todoId: string) {
    throw new Error('Method not implemented.');
  }
  private adminDataManager = inject(AdminTodoDataManagerService);
  
  // 🔗 Fassaden-Services für die Dropdowns einbinden
  private departmentService = inject(DepartmentService);
  private adminProjectService = inject(AdminProjectService);
  private adminTeamService = inject(AdminTeamService);

  // 🎛️ Öffentliche Signals & Status für die UI
  public readonly isOnline = this.adminDataManager.connectionService.isOnline;
  public readonly isLoading = this.adminDataManager.isLoading;
  public readonly activeFilter = this.adminDataManager.activeFilter;

  // 📋 Relektiert die Rohdaten aus dem DataManager
  public readonly rawAdminTodos = computed(() => this.adminDataManager.adminTodosPool());

  // 🏢 Dropdown-Daten aus den Partner-Services weiterleiten
  public readonly departmentOptions = this.departmentService.departmentsSorted;
  public readonly projectOptions = this.adminProjectService.activeProjects;
  public readonly userOptions = this.adminTeamService.adminUsersSignal;

  // 🛡️ Hilfs-Computed: Prüft, ob ein Filter aktiv gesetzt wurde
  public readonly hasActiveFilter = computed(() => {
    const filter = this.activeFilter();
    return !!(filter && (filter.projectId || filter.targetUserId || filter.isArchived || filter.departmentId));
  });

  // 📊 Statistik-Computed fürs Admin-Dashboard
  public readonly todoStats = computed(() => {
    const todos = this.rawAdminTodos();
    return {
      total: todos.length,
      completed: todos.filter(t => t.done).length,
      open: todos.filter(t => !t.done).length
    };
  });

  // ==========================================
  // 📝 ACTIONS
  // ==========================================

  /**
   * Reicht den neuen Filter an den DataManager weiter
   */
  public applyFilter(filter: AdminTodoFilter): void {
    this.adminDataManager.applyFilter(filter);
  }

  public archiveTodo(todoId: string) {
    this.adminDataManager.archiveTodo(todoId)
  }
  
  public restoreTodo(todoId: string) {
    this.adminDataManager.restoreTodo(todoId)
  }

  public saveSanitizationFeedback(todoId: string, matches: SensitiveMatch[], feedbackMap: Map<string, boolean | null>): void {
    const feedback = SanitizationFeedback.fromFeedbackMap(todoId, matches, feedbackMap);
    
    if (feedback.feedbacks.length === 0) {
      return; // Keine Änderungen vom Admin getroffen
    }

    // 🔄 Übergabe an den Queue-DataManager statt direktes subscribe()
    this.adminDataManager.saveSanitizationFeedback(feedback, todoId);
  }

  // ==========================================
  // 🧹 BASE DATA MANAGER OVERRIDES
  // ==========================================

  public override checkUnsavedData(): string | null {
    return null;
  }

  public override resetData(): void {
    // UI-spezifischer Reset falls nötig
  }
}