import { Component, input, output } from '@angular/core';
import { UserModel } from '../../../../models/user-model';

@Component({
  selector: 'app-member-card-component',
  imports: [],
  templateUrl: './member-card-component.html',
  styleUrl: './member-card-component.css',
})
export class MemberCardComponent {
  // 📥 Inputs vom Typ Signal
  public user = input.required<UserModel>();
  public actionType = input<'add' | 'remove'>('add'); // Standardmäßig 'add'

  // 📤 Output-Event nach oben
  public actionClicked = output<void>();

  public onButtonClick(): void {
    this.actionClicked.emit();
  }

  public onDragStart(event: DragEvent): void {
    if (event.dataTransfer) {
      // Wir packen die ID als reinen Text ('text/plain') in den Daten-Transport
      event.dataTransfer.setData('text/plain', this.user().id);
      
      // Das erlaubt dem Browser, die Karte visuell sauber zu "verschieben"
      event.dataTransfer.effectAllowed = 'move';
    }
  }
}