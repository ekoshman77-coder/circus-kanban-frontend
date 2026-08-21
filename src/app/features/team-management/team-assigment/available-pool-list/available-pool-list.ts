import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';
import { DepartmentsSelectResult, DepartmetSelectModal } from '../../../../core/shared/components/departmet-select-modal/departmet-select-modal';
import { InvitationService } from '../../../../core/services/invitation/invitation-service';
import { UserSummary } from '../../../../core/models/user-summary';
import { ProjectMember } from '../../../../core/models/project-member';

@Component({
  selector: 'app-available-pool-list',
  standalone: true,
  imports: [MemberCardComponent, DepartmetSelectModal, DragDropModule],
  templateUrl: './available-pool-list.html',
  styleUrl: './available-pool-list.css',
})
export class AvailablePoolListComponent {
  private invitationService = inject(InvitationService);

  public pool = input<ProjectMember[]>([]);
  public onNewUsersInvited = output<UserSummary[]>();
  public addUser = output<string>();
  public removeUser = output<string>();
  public removeFromPool = output<string>();

  public isTrashHovered = signal<boolean>(false);
  public isModalOpen = signal<boolean>(false);

  public allUsers = computed(() => {
    const users = this.pool().map(user => user.user);
    return users.sort((a, b) => {
      const diff = a.lastName.localeCompare(b.lastName);
      return diff !== 0 ? diff : a.firstName.localeCompare(b.firstName);
    });
  });

  public onAdd(userId: string): void {
    this.addUser.emit(userId);
  }

  // 🎯 CDK Drop-Event für Karten, die aus dem Projekt zurück in die Wartebank gezogen werden
  public onPoolDrop(event: CdkDragDrop<any>): void {
    const userId = event.item.data;
    if (userId) {
      this.removeUser.emit(userId);
    }
  }

  // 🎯 CDK Drop-Event für den Automaten-Schlitz (Entfernen)
  public onTrashDrop(event: CdkDragDrop<any>): void {
    this.isTrashHovered.set(false);
    const userId = event.item.data;
    if (userId) {
      this.removeFromPool.emit(userId);
    }
  }

  // 🎯 CDK Hover-States für die Schlitz-Expansion
  public onTrashEntered(): void {
    this.isTrashHovered.set(true);
  }

  public onTrashExited(): void {
    this.isTrashHovered.set(false);
  }

  public openDepartmentModal(): void { this.isModalOpen.set(true); }
  public closeDepartmentModal(): void { this.isModalOpen.set(false); }

  public onDepartmentsSeleted(selected: DepartmentsSelectResult): void {
    this.closeDepartmentModal();
    if (selected.departmentIds.length === 0) return;

    this.invitationService.loadUsersForInvitation(selected.departmentIds, selected.roles).subscribe({
      next: (data: UserSummary[]) => this.onNewUsersInvited.emit(data)
    });
  }
}