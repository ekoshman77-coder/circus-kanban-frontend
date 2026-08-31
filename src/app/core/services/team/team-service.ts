import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { TeamDataManager } from './team-data-manager';
import { ProjectRole, UserModel } from '../../models/user-model';
import { ProjectAction } from '../../enums/project-action-enum';
import { UserService } from '../user/user-service';
import { ProjectMember } from '../../models/project-member';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { Department } from '../../models/department';
import { UserSummary } from '../../models/user-summary';
import { PermissionService } from '../permissions/permission-service';

@Injectable({
    providedIn: 'root',
})
export class TeamService extends BaseDataManager {

    private dataManager = inject(TeamDataManager);
    private userService = inject(UserService);
    private permissionService = inject(PermissionService)

    // 🎯 Reicht das globale Signal aus dem DataManager direkt weiter (z.B. fürs Dropdown)
    public globalMembersSignal: Signal<ProjectMember[]> = this.dataManager.globalMembersSignal;
    public currentProjectMembersSignal: Signal<ProjectMember[]> = this.dataManager.currentProjectMembersSignal;

    private _currentProjectId = signal<string | null>(null);
    public currentProjectId = this._currentProjectId.asReadonly();

    /** * ✍️ 3. DIE METHODE, die du vorgeschlagen hast! 
     * Nur hierüber darf das Projekt gewechselt werden.
     */
    public setCurrentProject(projectId: string | null): void {
        console.log(`🎯 [TeamService] Projekt gewechselt auf: ${projectId}`);

        // ID setzen
        this._currentProjectId.set(projectId);

        // Automatisch den Sync im DataManager anstoßen!
        if (projectId) {
            this.dataManager.loadProjectMembers(projectId);
        }
    }

    /** 📡 Triggert das Laden der Projektdaten im DataManager */
    private triggerProjectTeamSync(projectId: string | null): void {
        if (projectId) {
            console.log(`📡 [TeamService] Lade Projektdaten für ID: ${projectId}`);
            this.dataManager.loadProjectMembers(projectId);
        }
    }

    /** 📡 Triggert das Laden des globalen User-Pools */
    public loadGlobalPool(): void {
        console.log(`📡 [TeamService] Lade globalen User-Pool`);
        this.dataManager.loadGlobalMembers();
    }

    /** 👑 Triggert das Laden des ungefilterten, globalen User-Pools exklusiv für Admins */
    public loadAdminPool(): void {
        console.log(`📡 [TeamService] Lade unzensierten Admin-User-Pool`);
        this.dataManager.loadAdminBoardPool();
    }

    /** 🛡️ Die universelle Rechte-Prüfung basierend auf dem neuen Signal */
    public hasPermission(projectId: string | null, action: ProjectAction): boolean {
        const currentUserId = this.userService.getCurrentUserId();
        if (!currentUserId || !projectId) return false;

        // Wir lesen ganz entspannt das synchrone Projekt-Signal aus!
        const members = this.currentProjectMembersSignal();
        const myBinding = members.find(m => m.user.id === currentUserId);

        if (!myBinding) return false;

        const currentRole = myBinding.projectRole as ProjectRole;
        const allowed = this.permissionService.hasPermission(currentRole, action, 'PROJECT', 'PROJECT');
        return allowed;
    }

    /** ➕ Reicht das Hinzufügen an den DataManager weiter */
    public addMemberToProject(projectId: string | null, member: UserModel | UserSummary, projectRole: ProjectRole): void {
        console.log("TEAMSERVICE: addMemberToProject")

        if (projectId) {
            this.dataManager.addMemberToProject(projectId, member, projectRole);
        }
    }

    /** ➖ Reicht das Entfernen an den DataManager weiter */
    public removeMemberFromProject(projectId: string | null, id: string): void {
        if (projectId) {
            this.dataManager.removeMemberFromProject(projectId, id);
        }
    }

    // --- AB HIER: ALTE/KOMPATIBILITÄTS-METHODEN (FÜR ANDERE KOMPONENTEN) ---

    /** 📦 Liefert die UserModel[] aus dem aktiven Projekt-Signal */
    public getProjectUsersSignal(projectId: string | null): Signal<UserModel[]> {
        return computed(() => this.currentProjectMembersSignal().map(m => m.user));
    }

    /** 📦 Fallback-Methode, falls noch alte Komponenten ein Observable erwarten */
    public getProjectUsers$(projectId: string | null): Observable<UserModel[]> {
        if (projectId) {
            this.dataManager.loadProjectMembers(projectId);
        }
        return new Observable<UserModel[]>(subscriber => {
            // Ein einfacher Brückenschlag vom Signal zum Observable
            const members = this.currentProjectMembersSignal().map(m => m.user);
            subscriber.next(members);
            subscriber.complete();
        });
    }

    /** ✍️ Aktualisiert ein globales Mitglied (z.B. Profiländerungen) */
    public updateMember(updatedMember: UserModel): void {
        console.log(`📡 [TeamService] Update globales Mitglied: ${updatedMember.username}`);
        this.dataManager.updateGlobalMember(updatedMember);
    }

    /** ☕ Aktualisiert das Kaffeekonto eines Users weltweit */
    public updateCoffeeAccount(userId: string, newBalance: number, role: string, emoji: string): void {
        console.log(`📡 [TeamService] Kaffeekonto-Update für ID: ${userId} auf ${newBalance}`);
        this.dataManager.updateCoffeeAccount(userId, newBalance, role, emoji);
    }

    /** 💀 Löscht einen Benutzer komplett global aus dem System */
    public deleteMember(projectId: string | null, id: string): void {
        console.log(`📡 [TeamService] Lösche globales Mitglied mit ID: ${id}`);
        this.dataManager.deleteGlobalMember(id);
    }

    /** 🚀 Registriert einen brandneuen Benutzer im System (Mit Kaffeekonto-Rolle!) */
    public createMember(member: UserModel, password: string, onError?: (errorMessage?: string) => void): void {
        console.log(`📡 [TeamService] Erstelle neuen Benutzer: ${member.username}`);

        // 🎯 Hier reichen wir das 'onError' 1:1 an den DataManager weiter!
        this.dataManager.createMember(member, password, onError);
    }

    public override resetData(): void {
        this._currentProjectId.set(null);
    }

    /** 🔓 Schaltet ein Mitglied frei und weist eine Abteilung zu (inkl. Offline-Schutz) */
    // public approveMember(userId: string, department: Department): void {
    //     console.log(`📡 [TeamService] Approve Mitglied mit ID: ${userId} für Abteilung: ${department.name}`);
    //     this.dataManager.approveGlobalMember(userId, department);
    // }
}