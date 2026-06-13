import { Component, inject, signal } from '@angular/core';
import { QuickPanelComponent, QuickPanelMode } from '../quick-panel-component/quick-panel-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { CommonModule } from '@angular/common';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';

@Component({
  selector: 'app-quick-action-center-component',
  imports: [CommonModule, QuickPanelComponent, MilestoneSelectorComponent],
  templateUrl: './quick-action-center-component.html',
  styleUrl: './quick-action-center-component.css',
})
export class QuickActionCenterComponent {
     
   private todoService = inject(TodoService)
   actuelModus = signal<QuickPanelMode>(QuickPanelMode.ACTIVE)
   protected readonly QuickPanelMode = QuickPanelMode
   public newMilestoneId = signal<string | null>(null);

   setModus(modus: QuickPanelMode) {
     this.actuelModus.set(modus)
   }

   toastMessage = signal<string | null>(null)
   
public onTaskSelected(task: string) {
      const points = this.actuelModus() === QuickPanelMode.ACTIVE ? 1 : 0;
      
      const milestoneId = this.newMilestoneId(); 

      this.todoService.createAndAddTodo({
        task: task, 
        description: "", 
        effort: points, 
        dueDate: Date.now(),
        // Wenn eine ID da ist, schicken wir sie mit – ansonsten bleibt sie undefined
        milestoneId: milestoneId ?? null,
        isStarted: false
      });
    
      this.toastMessage.set(
        `Aufgabe "${task}" wurde erfolgreich für HEUTE mit ${points} Punkt${points == 0 ? "e" : ""} Aufwand erstellt!`);

      this.newMilestoneId.set(null);
   }

   closeToast() {
      this.toastMessage.set(null)
   }

   public onMilestoneSelected(milestoneId: string | null): void {
     this.newMilestoneId.set(milestoneId);
   }
}
