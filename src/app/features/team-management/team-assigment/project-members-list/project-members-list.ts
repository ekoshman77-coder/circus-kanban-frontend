import { Component, input, output } from '@angular/core';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ProjectMember } from '../../../../core/models/project-member';
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';

@Component({
  selector: 'app-project-members-list',
  standalone: true,
  imports: [MemberCardComponent, DragDropModule],
  templateUrl: './project-members-list.html',
  styleUrl: './project-members-list.css',
})
export class ProjectMembersListComponent {
  public members = input<ProjectMember[]>([]);
  
  public addUser = output<string>();
  public removeUser = output<string>();
  public changeRole = output<string>()

  public onRemove(userId: string): void {
    this.removeUser.emit(userId);
  }

  // 🎯 CDK Drop-Event für Karten, die in die Projekt-Liste gezogen werden
  public onDrop(event: CdkDragDrop<any>): void {
    const userId = event.item.data;
    if (userId) {
      console.log('⚽ Projekt-Liste hat ID via CDK gefangen:', userId);
      this.addUser.emit(userId);
    }
  }

  public onBadgeClicked(userId: string) {
     this.changeRole.emit(userId)
  }
}