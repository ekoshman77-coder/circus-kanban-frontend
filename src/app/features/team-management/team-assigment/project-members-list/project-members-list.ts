import { Component, input, output } from '@angular/core';
import { UserModel } from '../../../../core/models/user-model';
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';

@Component({
  selector: 'app-project-members-list',
  imports: [MemberCardComponent],
  templateUrl: './project-members-list.html',
  styleUrl: './project-members-list.css',
})
export class ProjectMembersListComponent {
  public members = input<UserModel[]>([]);
  public addUser = output<string>();

  public removeUser = output<string>();

  public onRemove(userId: string): void {
    this.removeUser.emit(userId);
  }

  // 1. Das Standard-Verbot des Browsers blockieren
  public onDragOver(event: DragEvent): void {
    event.preventDefault(); // Unbedingt nötig! Sagt dem Browser: "Ja, man darf hier abwerfen!"

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'; // Ändert den Mauszeiger zu einem "Verschieben"-Symbol
    }
  }

  // 2. Den Koffer auspacken, wenn losgelassen wird
  public onDrop(event: DragEvent): void {
    event.preventDefault(); // Verhindert, dass der Browser z.B. eine Textdatei öffnet

    if (event.dataTransfer) {
      // Wir holen uns die User-ID, die die MemberCard im ersten Schritt hineingepackt hat!
      const userId = event.dataTransfer.getData('text/plain');

      console.log('⚽ Projekt-Liste hat ID gefangen:', userId); // 👈 Das hier rein!
      if (userId) {
        // Wir feuern die ID nach oben zum großen Elternteil (TeamAssignmentComponent)
        this.addUser.emit(userId);
      }
    }
  }
}