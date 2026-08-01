import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoFormComponent } from '../../../core/shared/components/todo-form/todo-form';
import { TodoListComponent } from '../todo-list-component/todo-list-component';
import { TodoFooterComponent } from '../todo-footer-component/todo-footer-component';
import { TodoKanbanComponent } from '../todo-kanban-component/todo-kanban-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { PlannerComponent } from '../../planner/planner-component/planner-component';
import { ArchivExpressComponent } from '../../archiv-express/archiv-express-component/archiv-express-component';
import { GamificationResult } from '../../../core/models/gamification';

@Component({
  selector: 'app-todo-page',
  standalone: true,
  // TodoKanbanComponent hier in die Imports eintragen!
  imports: [CommonModule, 
    TodoFormComponent, 
    TodoListComponent, 
    TodoKanbanComponent,
    ArchivExpressComponent
  ], 
  templateUrl: './todo-page-component.html',
  styleUrl: './todo-page-component.css'
})
export class TodoPageComponent {
  private todoService = inject(TodoService);
  
  // Signal hält den Zustand: Entweder 'list' oder 'kanban'
  public currentView = signal<'list' | 'kanban' | 'express'>('list');
  public pageError = computed(() => this.todoService.globalError());

  protected activeDeletedTodo = computed(() => this.todoService.lastDeletedTodo());
  protected localShowLevelUpBanner = signal<GamificationResult | null>(null);

  constructor() {
    // 3. Der reaktive Wächter für das Level-Up
    effect(() => {
      const result = this.todoService.latestGamificationResult();
      
      // Wenn ein Ergebnis da ist UND ein Level-Up stattgefunden hat:
      if (result && result.levelUp) {
        // Mit einer kleinen Verzögerung nach dem Salute die Plakate öffnen
        setTimeout(() => {
          this.localShowLevelUpBanner.set(result);
        }, 800);
      }
    });
  }

  public deleteToastProgress = computed(() => this.todoService.toastProgress())
  public restoreTodo() {
    this.todoService.restoreTodo()
  }

  protected closeBanner() {
    this.localShowLevelUpBanner.set(null);
    
    // WICHTIG: Wir setzen das Gamification-Result im Service danach wieder auf null,
    // damit der Effekt beim nächsten Erledigen eines To-Dos wieder sauber triggern kann!
    this.todoService.latestGamificationResult.set(null);
  }

   // Methode zum Umschalten
  public setView(view: 'list' | 'kanban' | 'express'): void {
    this.currentView.set(view);
  }
}