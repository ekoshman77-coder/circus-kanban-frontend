// quick-action-center-component.ts
import { Component, inject, signal } from '@angular/core';
import { QuickPanelComponent, QuickPanelMode } from '../quick-panel-component/quick-panel-component';
import { TodoService } from '../../../core/services/todo/todo-service';
import { CommonModule } from '@angular/common';
import { MilestoneSelectorComponent } from '../../../core/shared/components/milestone-selector-component/milestone-selector-component';
import { TodoPlanningModalComponent } from '../../../core/shared/components/todo-planning-modal-component/todo-planning-modal-component';

@Component({
  selector: 'app-quick-action-center-component',
  imports: [CommonModule, QuickPanelComponent, MilestoneSelectorComponent, TodoPlanningModalComponent], // 💡 IMPORT HIER REIN
  templateUrl: './quick-action-center-component.html',
  styleUrl: './quick-action-center-component.css',
})
export class QuickActionCenterComponent {
   private todoService = inject(TodoService)
   
   actuelModus = signal<QuickPanelMode>(QuickPanelMode.ACTIVE)
   protected readonly QuickPanelMode = QuickPanelMode
   public newMilestoneId = signal<string | null>(null);

   // 🎪 Neue Signals für die Modal-Steuerung
   public isModalOpen = signal<boolean>(false);
   public prefilledTaskName = signal<string>('');

   setModus(modus: QuickPanelMode) {
     this.actuelModus.set(modus)
   }

   toastMessage = signal<string | null>(null)
   
   // 💡 Klick auf Quick-Panel: Öffnet jetzt das edle Planning-Formular!
   public onTaskSelected(task: string) {
      // 1. Text für das Formular zwischenspeichern
      this.prefilledTaskName.set(task);
      // 2. Vorhang auf für das Modal!
      this.isModalOpen.set(true);
   }

   // 💾 Wird gefeuert, wenn der User im Modal erfolgreich auf "Planen!" drückt
   public onTodoModalPlanned() {
      this.isModalOpen.set(false);
      this.toastMessage.set(`⚡ Aufgabe wurde erfolgreich im Planning geschmiedet und eingepflegt!`);
      this.newMilestoneId.set(null);
   }

   closeToast() {
     this.toastMessage.set(null)
   }

   onMilestoneSelected(milestoneId: string | null) {
     this.newMilestoneId.set(milestoneId);
   }
}