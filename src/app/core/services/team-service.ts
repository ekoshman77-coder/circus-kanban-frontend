import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TeamDataManager } from './team-data-manager';
import { UserModel } from '../models/user-model';

@Injectable({
    providedIn: 'root',
})
export class TeamService {

    // Wir injizieren den DataManager im Constructor
    constructor(private dataManager: TeamDataManager) { }

    /**
     * 📡 Holt die Teammitglieder aus dem DataManager,
     * jagt sie durch eine Pipeline und sortiert sie alphabetisch!
     */
    public getSortedMembers$(projectId: string | null): Observable<UserModel[]> {
        return this.dataManager.getMembers$(projectId).pipe(
            map((unsortedArray: UserModel[]) => {
                return [...unsortedArray].sort((a, b) => a.firstName.localeCompare(b.firstName));
            })
        );

    }

    public getSortedByLastName$(projectId: string | null): Observable<UserModel[]> {
        return this.dataManager.getMembers$(projectId).pipe(
            map((unsortedArray: UserModel[]) => {
                return [...unsortedArray].sort((a, b) => a.lastName.localeCompare(b.lastName));
            })
        );
    }

    public updateMember(updatedMember: UserModel): void {
        console.log("updateMember: Starte Profil-Update");
        this.dataManager.updateGlobalMember(updatedMember);
    }

    /** 💀 Löscht den User jetzt wirklich global! */
    public deleteMember(projectId: string | null, id: string): void {
        this.dataManager.deleteGlobalMember(id);
    }
    public createMember(member: UserModel, onError?: (errorMessage: string) => void) {
        this.dataManager.createMember(member, onError)
    }

    /** 💡 NEU: Splittet die Logik sauber auf! */
    public removeMemberFromProject(projectId: string | null, id: string): void {
        if (projectId) {
            this.dataManager.removeMemberFromProject(projectId, id);
        }
    }

    /** ➕ NEU: Weist ein Mitglied einem bestimmten Projekt zu */
    public addMemberToProject(projectId: string | null, member: UserModel): void {
        if (projectId) {
            this.dataManager.addMemberToProject(projectId, member);
        }
    }
}