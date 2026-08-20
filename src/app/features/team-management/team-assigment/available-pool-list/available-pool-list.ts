import { Component, computed, inject, input, output, signal } from '@angular/core';
import { UserModel } from '../../../../core/models/user-model';
import { MemberCardComponent } from '../../../../core/shared/components/member-card/member-card-component/member-card-component';
import { DepartmentsSelectResult, DepartmetSelectModal } from '../../../../core/shared/components/departmet-select-modal/departmet-select-modal';
import { InvitationService } from '../../../../core/services/invitation/invitation-service';
import { UserSummary } from '../../../../core/models/user-summary';
import { ProjectMember } from '../../../../core/models/project-member';

@Component({
  selector: 'app-available-pool-list',
  imports: [MemberCardComponent, DepartmetSelectModal],
  templateUrl: './available-pool-list.html',
  styleUrl: './available-pool-list.css',
})
export class AvailablePoolListComponent {
  private invitationService = inject(InvitationService)

  // 📥 Das Elternteil (TeamAssignmentComponent) übergibt hier den verfügbaren Pool
  public pool = input<ProjectMember[]>([]);

  public onNewUsersInvited = output<UserSummary[]>()
  public addUser = output<string>();
  public removeUser = output<string>();

  public allUsers = computed(() => {
    const users =  this.pool().map(user => user.user)
    return users
      .sort((a,b) => {
        const diff = a.lastName.localeCompare(b.lastName)
        if (diff !== 0) {
          return diff
        } 
        return a.firstName.localeCompare(b.firstName)
      })
  })
  
  
  // 📤 Event nach oben ans Elternteil feuern, wenn jemand hinzugefügt wird

  public isModalOpen = signal<boolean>(false)

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
        this.removeUser.emit(userId); 
      }
    }
  }

  public openDepartmentModal() {
     this.isModalOpen.set(true)
  }

  public closeDepartmentModal() {
     this.isModalOpen.set(false)
  }

  public onDepartmentsSeleted(selected: DepartmentsSelectResult) {
    this.closeDepartmentModal()
    if (selected.departmentIds.length == 0) {
      return
    } 

    console.log('Ausgewählte Abteilungen:', selected.departmentIds, selected.roles);
    this.invitationService.loadUsersForInvitation(selected.departmentIds, selected.roles).subscribe({
      next: (data: UserSummary[]) => {
          this.onNewUsersInvited.emit(data)
      }
    })    
  }
}