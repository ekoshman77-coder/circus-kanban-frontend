import { Component, input, output } from '@angular/core';
import { ProjectRole, UserModel } from '../../../../models/user-model'; 
import { UserSummary } from '../../../../models/user-summary';

@Component({
  selector: 'app-member-card-component',
  standalone: true,
  imports: [],
  templateUrl: './member-card-component.html',
  styleUrl: './member-card-component.css',
})
export class MemberCardComponent {
  // 📥 Inputs vom Typ Signal
  public user = input.required<UserModel | UserSummary>();
  public actionType = input<'add' | 'remove'>('add'); 

  // 🎭 DAS NEUE HIGHLIGHT: Ein optionales Input für die Projekt-Rolle!
  public projectRole = input<ProjectRole | null>(null);

  // 📤 Output-Event nach oben
  public actionClicked = output<void>();

  public onButtonClick(): void {
    this.actionClicked.emit();
  }

  public onDragStart(event: DragEvent): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', this.user().id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }
}