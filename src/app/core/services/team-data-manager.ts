import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ProjectRole, UserModel } from '../models/user-model';
import { TeamRepository } from '../repositories/team-repository';
import { ProjectMember } from '../models/project-member';
import { IUser, UserRepository } from '../repositories/user-repository';
import { ConnectionService } from './connection-service';

@Injectable({
  providedIn: 'root'
})
export class TeamDataManager {
  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository); // 🎯 Echte Repositories injected!
  private connectionService = inject(ConnectionService);

  // 🎯 Wir nutzen zwei einfache Signals statt einer komplizierten Map!
  public currentProjectMembersSignal = signal<ProjectMember[]>([]);
  public globalMembersSignal = signal<ProjectMember[]>([]);

  /** 📥 Holt die echten Mitglieder für ein Projekt und setzt das Signal */
  public loadProjectMembers(projectId: string): void {
    console.log(`🚀 [DataManager] Lade frische Mitglieder für Projekt: ${projectId}`);
    this.teamRepository.getMembersForProject$(projectId).subscribe({
      next: (members) => {
        console.log(`📬 [DataManager] Projekt-Mitglieder geladen. Anzahl: ${members.length}`, members);
        this.currentProjectMembersSignal.set(members);
      },
      error: (err) => console.error("❌ Fehler beim Laden der Projektmitglieder:", err)
    });
  }

  /** 🌍 Holt alle globalen Benutzer für das Dropdown */
  public loadGlobalMembers(): void {
    console.log(`🚀 [DataManager] Lade globalen User-Pool...`);
    this.teamRepository.getAllGlobalUsers$().subscribe({
      next: (members) => {
        console.log(`📬 [DataManager] Globaler Pool geladen. Anzahl: ${members.length}`);
        this.globalMembersSignal.set(members);
      },
      error: (err) => console.error("❌ Fehler beim Laden der globalen User:", err)
    });
  }

  /** ➕ Mitglied hinzufügen */
  public addMemberToProject(projectId: string, member: UserModel, projectRole: ProjectRole): void {
    this.teamRepository.assignToProject$(projectId, member.id, projectRole).subscribe({
      next: () => {
        console.log(`✨ [DataManager] ${member.username} erfolgreich zugewiesen. Aktualisiere Liste...`);
        // Direkt danach die Liste neu laden – absolut atomsicher!
        this.loadProjectMembers(projectId);
      }
    });
  }

  /** ➖ Mitglied entfernen */
  public removeMemberFromProject(projectId: string, memberId: string): void {
    this.teamRepository.deleteFromProject$(projectId, memberId).subscribe({
      next: () => {
        console.log(`✨ [DataManager] Mitglied gelöscht. Aktualisiere Liste...`);
        this.loadProjectMembers(projectId);
      }
    });
  }

/** ✍️ Aktualisiert ein globales Mitglied auf dem Server und lokal */
  public updateGlobalMember(updatedMember: UserModel): void {
    // 1. Lokales Signal-Update (Optimistic Update)
    const updatedList = this.globalMembersSignal().map(m => {
      if (m.user.id === updatedMember.id) {
        return new ProjectMember(updatedMember, m.projectRole); // Wir behalten das Binding bei
      }
      return m;
    });
    this.globalMembersSignal.set(updatedList);

    // 2. Server informieren
    if (this.connectionService.isOnline() && updatedMember.id) {
      this.userRepository.updateProfile$(
        updatedMember.id, 
        updatedMember.username, 
        updatedMember.firstName, 
        updatedMember.lastName
      ).subscribe({
        next: (serverUser) => {
          console.log(`✅ Profil von ${serverUser.username} aktualisiert.`);
          this.loadGlobalMembers(); // Synchronisieren
        },
        error: (err) => console.error('❌ Fehler beim Server-Profil-Update:', err)
      });
    }
  }

  /** 💀 Löscht einen User komplett global aus dem weltweiten System */
  public deleteGlobalMember(memberId: string): void {
    // 1. Lokal aus dem Signal löschen
    const updatedList = this.globalMembersSignal().filter(m => m.user.id !== memberId);
    this.globalMembersSignal.set(updatedList);

    // 2. Server informieren
    if (this.connectionService.isOnline()) {
      this.userRepository.deleteGlobalUser$(memberId).subscribe({
        next: () => {
          console.log(`💀 User ${memberId} global gelöscht.`);
          this.loadGlobalMembers();
        },
        error: (err) => console.error('❌ Fehler beim globalen Server-Delete:', err)
      });
    }
  }

  /** 🚀 Registriert einen brandneuen Benutzer im System */
  public createMember(member: UserModel, password: string, onError?: (errorMessage: string) => void): void {
    if (!this.connectionService.isOnline()) {
      if (onError) onError("die App ist offline");
      return;
    }
    console.log(`🚀 [TeamDataManager] Sende Registrierung für ${member.username} ans Backend...`);

    // Hinweis: Falls dein userRepository.register auch das Passwort brauchte, reich es hier ein:
    this.userRepository.register(member.username, member.firstName, member.lastName, password).subscribe({
      next: (user: IUser) => {
        console.log(`📬 [TeamDataManager] Backend-Antwort erhalten! User-ID: ${user.id}`);    
        
        const newModel = new UserModel({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          projectIds: []
        });

        const newProjectMember = new ProjectMember(newModel, 'NONE');
        
        // Lokal zum globalen Signal hinzufügen
        this.globalMembersSignal.set([...this.globalMembersSignal(), newProjectMember]);
        
        console.log(`✨ [TeamDataManager] ${user.username} lokal hinzugefügt.`);
        this.loadGlobalMembers(); // Lädt den Pool frisch herunter
      },
      error: (err: string) => {
        console.log("error bei registrieren neuen user", err);
        if (onError) onError(err);
      }
    });
  }

  /** ☕ Aktualisiert das Kaffeeguthaben eines Benutzers */
  public updateCoffeeAccount(userId: string, newBalance: number, role: string, emoji: string): void {
    // 1. Lokales Signal-Update
    const updatedList = this.globalMembersSignal().map(m => {
      if (m.user.id === userId) {
        m.user.coffeeBalance = newBalance;
      }
      return m;
    });
    this.globalMembersSignal.set(updatedList);
    console.log(`💾 [TeamDataManager] Kaffeestand lokal für User ${userId} auf ${newBalance} € gesetzt.`);

    // 2. Server-Update
    if (this.connectionService.isOnline()) {
      this.teamRepository.updateCoffeeAccount$(userId, newBalance, role, emoji).subscribe({
        next: (serverUser) => {
          console.log(`✅ [TeamDataManager] Server hat Kaffeekasse für ${serverUser.username} erfolgreich bestätigt.`);
          this.loadGlobalMembers(); 
        },
        error: (err) => console.error('❌ [TeamDataManager] Fehler beim Server-Kaffeekassen-Update:', err)
      });
    }
  }
}