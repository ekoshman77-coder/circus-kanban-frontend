import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ProjectRole, UserModel } from '../../models/user-model';
import { TeamRepository } from '../../repositories/team-repository';
import { ProjectMember } from '../../models/project-member';
import { IUser, UserRepository } from '../../repositories/user-repository';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service'; // 🎯 NEU importiert!

@Injectable({
  providedIn: 'root'
})
export class TeamDataManager {
  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService); // 🎯 NEU injiziert!

  // 🎯 Reaktive Signals für die UI
  public currentProjectMembersSignal = signal<ProjectMember[]>([]);
  public globalMembersSignal = signal<ProjectMember[]>([]);

  // 📡 Premium-Zusatz: Signalisiert der UI, ob das gewählte Projekt offline da ist!
  public isProjectOfflineAvailable = signal<boolean>(true);

  // 🔑 Keys für den LocalStorage
  private readonly STORAGE_KEY_GLOBAL = 'offline_global_members';
  private readonly STORAGE_KEY_PROJECT_PREFIX = 'offline_project_members_';

  constructor() {
    // 1. ⚡ SOFORT den alten globalen Cache laden, damit die UI steht und die Projekt-IDs DA sind!
    this.loadGlobalMembersFromCache();

    /**
     * 2. 📡 DER REAKTIVE ONLINE-TRIGGER (Der unermüdliche Wächter)
     * Dieser Effekt lauscht auf dein Connection-Signal. Sobald 'isOnline' wahr wird,
     * zieht er die frischen Daten vom Server und befüllt den Premium-Cache!
     */
    effect(() => {
      const online = this.connectionService.isOnline();
      console.log(`📡 [DataManager] Connection-Wächter spürt Zustand: ${online ? 'ONLINE 🟢' : 'OFFLINE 🔴'}`);

      if (online) {
        console.log('🔄 [DataManager] Signal steht auf ONLINE! Starte Server-Synchronisation...');
        untracked(() => {
        // Globale Liste frisch vom Server holen und Cache erneuern
        this.loadGlobalMembers();

        // Die 2-3 Projekte des Benutzers im Hintergrund jagen und wegsichern
        this.preloadUserProjectsIntoCache();
        })
      }
    });
  }

  /** 📥 Holt die Mitglieder für ein Projekt – mit intelligentem Offline-Schutzschild */
  public loadProjectMembers(projectId: string): void {
    const cacheKey = this.STORAGE_KEY_PROJECT_PREFIX + projectId;

    if (!this.connectionService.isOnline()) {
      console.log(`📡 [DataManager] Offline! Prüfe Cache für Projekt: ${projectId}`);
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        // Projekt existiert im Premium-Cache!
        this.isProjectOfflineAvailable.set(true);
        const parsed = JSON.parse(cached) as any[];
        const hydrated = parsed.map(m => new ProjectMember(new UserModel(m.user), m.projectRole));
        this.currentProjectMembersSignal.set(hydrated);
        console.log(`✨ [DataManager] Projekt ${projectId} erfolgreich reaktiv aus Cache geladen.`);
      } else {
        // 🚨 SONDERFALL: Das Projekt fehlt auf diesem Gerät völlig!
        console.warn(`🛑 [DataManager] Offline & Projekt ${projectId} NICHT im Cache vorhanden!`);
        this.isProjectOfflineAvailable.set(false); // Flagge für UI hissen!
        this.currentProjectMembersSignal.set([]);  // Liste leeren
      }
      return;
    }

    // Wenn wir online sind, ist immer alles verfügbar
    this.isProjectOfflineAvailable.set(true);
    console.log(`🚀 [DataManager] Online! Lade frische Mitglieder für Projekt: ${projectId}`);

    this.teamRepository.getMembersForProject$(projectId).subscribe({
      next: (members) => {
        this.currentProjectMembersSignal.set(members);
        localStorage.setItem(cacheKey, JSON.stringify(members)); // Im Cache einfrieren
      },
      error: (err) => console.error("❌ Fehler beim Laden der Projektmitglieder:", err)
    });
  }

  /** 🌍 Holt alle globalen Benutzer – offline-gesichert */
  public loadGlobalMembers(): void {
    if (!this.connectionService.isOnline()) {
      console.log(`📡 [DataManager] Offline! Nutze globalen Cache.`);
      this.loadGlobalMembersFromCache();
      return;
    }

    this.teamRepository.getAllGlobalUsers$().subscribe({
      next: (members) => {
        this.globalMembersSignal.set(members);
        localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(members));
      },
      error: (err) => console.error("❌ Fehler beim Laden der globalen User:", err)
    });
  }

  /** 🧠 PREMIUM-FUNKTION: Sucht alle Projekt-IDs des Users zusammen und saugt sie ab */
  private preloadUserProjectsIntoCache(): void {
    // Da UserService asynchron oder über Signals laufen kann, holen wir die ID
    const currentUserId = this.userService.getCurrentUserId();
    if (!currentUserId || !this.connectionService.isOnline()) return;

    // Wir suchen das UserModel des eingeloggten Users aus unserem globalen Signal
    const currentUserModel = this.globalMembersSignal()
      .map(m => m.user)
      .find(u => u.id === currentUserId);

    // Falls das Signal noch leer ist, lauschen wir beim ersten Laden
    const projectIds = currentUserModel ? currentUserModel.projectIds : [];

    if (projectIds.length > 0) {
      console.log(`🕵️‍♀️ [Premium-Cache] Starte Hintergrund-Sync für deine ${projectIds.length} Projekte...`);
      projectIds.forEach(id => {
        // Wir feuern die Requests unbemerkt im Hintergrund ab und speichern sie direkt im LocalStorage
        this.teamRepository.getMembersForProject$(id).subscribe({
          next: (members) => {
            localStorage.setItem(this.STORAGE_KEY_PROJECT_PREFIX + id, JSON.stringify(members));
            console.log(`💾 [Premium-Cache] Projekt ${id} im Hintergrund offline-gesichert.`);
          }
        });
      });
    }
  }

  /** ➕ Mitglied hinzufügen (Optimistic UI) */
  public addMemberToProject(projectId: string, member: UserModel, projectRole: ProjectRole): void {
    const newMemberBinding = new ProjectMember(member, projectRole);
    const cacheKey = this.STORAGE_KEY_PROJECT_PREFIX + projectId;

    const updatedList = [...this.currentProjectMembersSignal(), newMemberBinding];
    this.currentProjectMembersSignal.set(updatedList);
    localStorage.setItem(cacheKey, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.teamRepository.assignToProject$(projectId, member.id, projectRole).subscribe({
        next: () => this.loadProjectMembers(projectId)
      });
    }
  }

  /** ➖ Mitglied entfernen (Optimistic UI) */
  public removeMemberFromProject(projectId: string, memberId: string): void {
    const cacheKey = this.STORAGE_KEY_PROJECT_PREFIX + projectId;
    const updatedList = this.currentProjectMembersSignal().filter(m => m.user.id !== memberId);

    this.currentProjectMembersSignal.set(updatedList);
    localStorage.setItem(cacheKey, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.teamRepository.deleteFromProject$(projectId, memberId).subscribe({
        next: () => this.loadProjectMembers(projectId)
      });
    }
  }

  /** ☕ Kaffeekasse – Perfekt offline-resistent */
  public updateCoffeeAccount(userId: string, newBalance: number, role: string, emoji: string): void {
    const updatedList = this.globalMembersSignal().map(m => {
      if (m.user.id === userId) {
        m.user.coffeeBalance = newBalance;
        m.user.role = role;
        m.user.emoji = emoji;
      }
      return m;
    });
    this.globalMembersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.teamRepository.updateCoffeeAccount$(userId, newBalance, role, emoji).subscribe({
        next: () => this.loadGlobalMembers()
      });
    }
  }

  public updateGlobalMember(updatedMember: UserModel): void {
    const updatedList = this.globalMembersSignal().map(m => {
      if (m.user.id === updatedMember.id) return new ProjectMember(updatedMember, m.projectRole);
      return m;
    });
    this.globalMembersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline() && updatedMember.id) {
      this.userRepository.updateProfile$(updatedMember.id, updatedMember.username, updatedMember.firstName, updatedMember.lastName).subscribe({
        next: () => this.loadGlobalMembers()
      });
    }
  }

  public deleteGlobalMember(memberId: string): void {
    const updatedList = this.globalMembersSignal().filter(m => m.user.id !== memberId);
    this.globalMembersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.userRepository.deleteGlobalUser$(memberId).subscribe({
        next: () => this.loadGlobalMembers()
      });
    }
  }

  public createMember(member: UserModel, password: string, onError?: (errorMessage: string) => void): void {
    if (!this.connectionService.isOnline()) {
      if (onError) onError("Registrierungen sind im Offline-Modus nicht möglich.");
      return;
    }
    this.userRepository.register(member.username, member.firstName, member.lastName, password).subscribe({
      next: (user: IUser) => {
        const newModel = new UserModel({ id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, projectIds: [] });
        this.globalMembersSignal.set([...this.globalMembersSignal(), new ProjectMember(newModel, 'NONE')]);
        localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(this.globalMembersSignal()));
        this.loadGlobalMembers();
      },
      error: (err: string) => { if (onError) onError(err); }
    });
  }

  private loadGlobalMembersFromCache(): void {
    const cached = localStorage.getItem(this.STORAGE_KEY_GLOBAL);
    if (cached) {
      const parsed = JSON.parse(cached) as any[];
      const hydrated = parsed.map(m => new ProjectMember(new UserModel(m.user), m.projectRole));
      this.globalMembersSignal.set(hydrated);
    }
  }
}