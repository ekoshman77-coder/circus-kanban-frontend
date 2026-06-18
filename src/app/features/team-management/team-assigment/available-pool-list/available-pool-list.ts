import { Component, input, output } from '@angular/core';
import { UserModel } from '../../../../core/models/user-model';
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';

@Component({
  selector: 'app-available-pool-list',
  imports: [MemberCardComponent],
  templateUrl: './available-pool-list.html',
  styleUrl: './available-pool-list.css',
})
export class AvailablePoolListComponent {
  // 📥 Das Elternteil (TeamAssignmentComponent) übergibt hier den verfügbaren Pool
  public pool = input<UserModel[]>([]);

  // 📤 Event nach oben ans Elternteil feuern, wenn jemand hinzugefügt wird
  public addUser = output<string>();
  public removeUser = output<string>();

  public onAdd(userId: string): void {
    // Wir schicken die ID des ausgewählten Users nach oben
    this.addUser.emit(userId);
  }

  // 📥 2. NEU: Dem Browser erlauben, hier etwas abzuwerfen
  public onDragOver(event: DragEvent): void {
    event.preventDefault(); // Schaltet das Abwurfverbot des Browsers ab
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  // 📥 3. NEU: Die ID aus dem Koffer holen und nach oben jagen
  public onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      const userId = event.dataTransfer.getData('text/plain');
      if (userId) {
        this.removeUser.emit(userId); // Wir funken ans Elternteil: User aus Projekt entfernen!
      }
    }
  }
}