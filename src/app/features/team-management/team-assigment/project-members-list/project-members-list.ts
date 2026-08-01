import { Component, input, output } from '@angular/core';
import { ProjectMember } from '../../../../core/models/project-member'; // 🎯 Importieren!
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';

@Component({
  selector: 'app-project-members-list',
  standalone: true,
  imports: [MemberCardComponent],
  templateUrl: './project-members-list.html',
  styleUrl: './project-members-list.css',
})
export class ProjectMembersListComponent {
  // 🎯 Typ von UserModel[] auf ProjectMember[] geändert!
  public members = input<ProjectMember[]>([]);
  public addUser = output<string>();
  public removeUser = output<string>();

  public onRemove(userId: string): void {
    this.removeUser.emit(userId);
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  // 📦 HIER NEU: Packt die ID beim Ziehen der Karte ein
  public onDragStart(event: DragEvent, userId: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', userId);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      const userId = event.dataTransfer.getData('text/plain');
      console.log('⚽ Projekt-Liste hat ID gefangen:', userId);
      this.addUser.emit(userId);
    }
  }
}