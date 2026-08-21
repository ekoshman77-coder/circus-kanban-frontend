import { inject, Injectable, signal } from "@angular/core";
import { InvitationRepository } from "../../repositories/invitation-repository";
import { Department } from "../../models/department";
import { NotificationService } from "../notification/notification-service";
import { UserSummary } from "../../models/user-summary";
import { InviteRequestDto, SearchUserDto } from "../../repositories/dto/inivitation-dto";
import { BaseDataManager } from "../abstract-base-data-manager/base-data-manager";
import { catchError, map, Observable, of } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class InvitationService extends BaseDataManager {
    private invitationRepository = inject(InvitationRepository)
    private notificationService = inject(NotificationService)

    public departments = signal<Department[]>([])

    constructor() {
        super();
        this.loadDepartmentsForInvitation()
    }

    public loadDepartmentsForInvitation() {
        console.log("INVITATION_SEVICE loadDepartmentsForInvitation")
        this.invitationRepository.getDepartmentsForInvitation().subscribe({
           next: (next => {
           console.log("INVITATION_SEVICE loadDepartmentsForInvitation next = ", next)
            const depts = next.map(dept => Department.fromJson({
                name: dept.name,
                scope: dept.scope,
                id: dept.id?? ""
            }))
            this.departments.set(depts)
           }),
           error: (err) => {
             console.log("Fehler bei loading departements for invitaion")
             this.notificationService.showNotification("Fehler bei loading departements for invitaion", 'error')               
           } 
        })
    }

    public loadUsersForInvitation(departmentIds: string[], departmentRoles: string[]): Observable<UserSummary[]> {
        const payload: InviteRequestDto = {
            departmentIds: departmentIds,
            departmentRoles: departmentRoles
        }
        return this.invitationRepository.getUsersForInvitation(payload).pipe(
            map((data) => {
                console.log("INVITATION_SERVICE: users for invitaion", data)
                return data.map((user) => UserSummary.fromJson(user))
            }),
            catchError((error) => {
             console.log("Fehler bei loading users for invitaion")
             this.notificationService.showNotification("Fehler bei loading users for invitaion", 'error') 
             return of([])              
            }) 
        )
    }
    
    public override resetData(): void {
        this.departments.set([])
    }
}
