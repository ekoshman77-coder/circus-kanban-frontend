import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ProjectRole, UserModel } from '../../models/user-model';
import { TeamRepository } from '../../repositories/team-repository';
import { ProjectMember } from '../../models/project-member';
import { IUser, UserRepository } from '../../repositories/user-repository';
import { ConnectionService } from '../connection/connection-service';
import { UserService } from '../user/user-service'; // 🎯 NEU importiert!
import { NotificationService } from '../notification/notification-service';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { concat, toArray } from 'rxjs';
import { UserSummary } from '../../models/user-summary';

// Typdefinition für unsere Queue-Einträge
interface OfflineTeamAction {
  type: 'ADD_MEMBER' | 'REMOVE_MEMBER' | 'UPDATE_COFFEE' | 'UPDATE_PROFILE' | 'APPROVE_MEMBER';
  payload: any;
}

@Injectable({
  providedIn: 'root'
})
export class TeamDataManager extends BaseDataManager {
  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository);
  private connectionService = inject(ConnectionService);
  private userService = inject(UserService); // 🎯 NEU injiziert!
  private notificationService = inject(NotificationService)

  // 🎯 Reaktive Signals für die UI
  public currentProjectMembersSignal = signal<ProjectMember[]>([]);
  public globalMembersSignal = signal<ProjectMember[]>([]);
  public hasOfflineChanges = signal<boolean>(false);


  // 📡 Premium-Zusatz: Signalisiert der UI, ob das gewählte Projekt offline da ist!
  public isProjectOfflineAvailable = signal<boolean>(true);
  private offlineQueueSignal = signal<OfflineTeamAction[]>([]);

  private readonly STORAGE_KEY_GLOBAL = 'offline_global_members';
  private readonly STORAGE_KEY_PROJECT_PREFIX = 'offline_project_members_';
  private readonly STORAGE_KEY_QUEUE = 'offline_team_actions_queue';

  constructor() {
    super()
    // 1. ⚡ SOFORT den alten globalen Cache laden, damit die UI steht und die Projekt-IDs DA sind!
    this.loadGlobalMembersFromCache();
    this.loadQueueFromCache();

    /**
     * 2. 📡 DER REAKTIVE ONLINE-TRIGGER (Der unermüdliche Wächter)
     * Dieser Effekt lauscht auf dein Connection-Signal. Sobald 'isOnline' wahr wird,
     * zieht er die frischen Daten vom Server und befüllt den Premium-Cache!
     */
    effect(() => {
      const online = this.connectionService.isOnline();

      if (online) {
        console.log('🔄 [TeamDataManager] ONLINE! Starte Queue-Verarbeitung...');
        untracked(() => {
          this.syncOfflineQueueToServer();
        });
      }
    });
  }

  /** 📥 Lädt die Queue aus dem Cache beim App-Start */
  private loadQueueFromCache(): void {
    const cached = localStorage.getItem(this.STORAGE_KEY_QUEUE);
    if (cached) {
      this.offlineQueueSignal.set(JSON.parse(cached));
    }
  }

  /** 💾 Schreibt einen neuen Eintrag in die Queue */
  private pushToQueue(action: OfflineTeamAction): void {
    const updated = [...this.offlineQueueSignal(), action];
    this.offlineQueueSignal.set(updated);
    localStorage.setItem(this.STORAGE_KEY_QUEUE, JSON.stringify(updated));
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

    this.teamRepository.getMembersForProject$(this.userService.getCurrentUserId() ?? "", projectId).subscribe({
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

    this.teamRepository.getAllDepartmentUsers$(this.userService.getCurrentUserId() ?? "").subscribe({
      next: (members) => {
        console.log("teamRepository:: getAllGlobalUsers bekommt from server", members)
        this.globalMembersSignal.set(members);
        localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(members));
      },
      error: (err) => console.error("❌ Fehler beim Laden der globalen User:", err)
    });
  }

  /** 🔄 Verarbeitet alle gesammelten Offline-Aktionen sequentiell am Server */
  private syncOfflineQueueToServer(): void {
    const queue = this.offlineQueueSignal();
    if (queue.length === 0) {
      // Wenn keine Queue da ist, einfach direkt frisch laden
      this.loadGlobalMembers();
      this.preloadUserProjectsIntoCache();
      return;
    }

    console.log(`🚀 Sende ${queue.length} aufgestaute Offline-Aktionen zum Server...`);

    // Wir mappen die Aktionen in ein Array von Observables
    const requests = queue.map(action => {
      switch (action.type) {
        case 'ADD_MEMBER':
          return this.teamRepository.assignToProject$(action.payload.projectId, action.payload.memberId, action.payload.role);
        case 'REMOVE_MEMBER':
          return this.teamRepository.deleteFromProject$(action.payload.projectId, action.payload.memberId);
        case 'UPDATE_COFFEE':
          return this.teamRepository.updateCoffeeAccount$(action.payload.userId, action.payload.balance, action.payload.role, action.payload.emoji);
        case 'UPDATE_PROFILE':
          return this.userRepository.updateProfile$(action.payload.id, action.payload.username, action.payload.firstName, action.payload.lastName);
        case 'APPROVE_MEMBER':
          return this.userRepository.approveUser(action.payload.userId, action.payload.departmentId, action.payload.role);
      }
    });

    // Mit concat arbeiten wir die HTTP-Requests nacheinander ab, damit die Reihenfolge stimmt
    concat(...requests).pipe(toArray()).subscribe({
      next: () => {
        console.log('✅ Alle Offline-Änderungen erfolgreich mit dem Server synchronisiert!');
        this.notificationService.showNotification('Alle Offline-Änderungen wurden synchronisiert. 🔄', 'success');

        // Queue leeren
        this.offlineQueueSignal.set([]);
        localStorage.removeItem(this.STORAGE_KEY_QUEUE);

        // Erst JETZT die frischen Daten vom Server holen
        this.loadGlobalMembers();
        this.preloadUserProjectsIntoCache();
      },
      error: (err) => {
        console.error('❌ Fehler bei der Synchronisation der Offline-Queue:', err);
        this.notificationService.showNotification('Fehler beim Synchronisieren der Team-Daten.', 'error');
      }
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
        this.teamRepository.getMembersForProject$(this.userService.getCurrentUserId() ?? "", id).subscribe({
          next: (members) => {
            localStorage.setItem(this.STORAGE_KEY_PROJECT_PREFIX + id, JSON.stringify(members));
            console.log(`💾 [Premium-Cache] Projekt ${id} im Hintergrund offline-gesichert.`);
          }
        });
      });
    }
  }

  /** 👑 Holt den ungefilterten Pool aller Firmenmitglieder für das Admin-Board */
  public loadAdminBoardPool(): void {
    // Wenn wir offline sind, greifen wir auf den bestehenden globalen Cache zurück
    if (!this.connectionService.isOnline()) {
      console.log(`📡 [DataManager] Offline! Nutze globalen Cache für Admin-Board.`);
      this.loadGlobalMembersFromCache();
      return;
    }

    // Online: Hol die echte Komplettliste
    this.teamRepository.getAllUsersForAdminBoard$().subscribe({
      next: (members) => {
        console.log("📡 [DataManager] Admin-Pool erfolgreich vom Server geladen:", members);
        this.globalMembersSignal.set(members);
        localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(members)); // Cache überschreiben
      },
      error: (err) => console.error("❌ Fehler beim Laden des Admin-User-Pools:", err)
    });
  }

  /** ➕ Mitglied hinzufügen (Optimistic UI) */
  public addMemberToProject(projectId: string, member: UserModel | UserSummary, projectRole: ProjectRole): void {
    console.log("TEAM_DATAMANAGER: addMemberToProject")

    const newMemberBinding = new ProjectMember(member, projectRole);
    const cacheKey = this.STORAGE_KEY_PROJECT_PREFIX + projectId;
    const filteredList = this.currentProjectMembersSignal().filter(m => m.user.id !== member.id)
    const updatedList = [...filteredList, newMemberBinding];
    this.currentProjectMembersSignal.set(updatedList);
    localStorage.setItem(cacheKey, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.teamRepository.assignToProject$(projectId, member.id, projectRole).subscribe({
        next: () => this.loadProjectMembers(projectId)
      });
    } else {
      // In Queue einreihen
      this.pushToQueue({ type: 'ADD_MEMBER', payload: { projectId, memberId: member.id, role: projectRole } });
    }
  }

  public removeMemberFromProject(projectId: string, memberId: string): void {
    const cacheKey = this.STORAGE_KEY_PROJECT_PREFIX + projectId;
    const updatedList = this.currentProjectMembersSignal().filter(m => m.user.id !== memberId);
    this.currentProjectMembersSignal.set(updatedList);
    localStorage.setItem(cacheKey, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.teamRepository.deleteFromProject$(projectId, memberId).subscribe({
        next: () => this.loadProjectMembers(projectId)
      });
    } else {
      this.pushToQueue({ type: 'REMOVE_MEMBER', payload: { projectId, memberId } });
    }
  }

  /** ☕ Kaffeekasse – Perfekt offline-resistent */
  public updateCoffeeAccount(userId: string, newBalance: number, role: string, emoji: string): void {
    const updatedMember = this.globalMembersSignal().find(user => user.user.id === userId)
    if (!updatedMember || updatedMember.isPending) {
      return
    }

    const updatedList = this.globalMembersSignal().map(m => {
      if (m.user.id === userId) {
        m.user.coffeeAccount = {
          balance: newBalance,
          role: role,
          emoji: emoji,
        }
      }
      return m;
    });

    this.globalMembersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.teamRepository.updateCoffeeAccount$(userId, newBalance, role, emoji).subscribe({
        next: () => this.loadGlobalMembers()
      });
    } else {
      this.pushToQueue({ type: 'UPDATE_COFFEE', payload: { userId, balance: newBalance, role, emoji } });
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
    } else {
      this.pushToQueue({ type: 'UPDATE_PROFILE', payload: updatedMember });
    }
  }

  public deleteGlobalMember(memberId: string): void {
    // Wir suchen uns kurz den Namen raus, bevor er aus dem lokalen Signal fliegt
    const user = this.globalMembersSignal().map(m => m.user).find(u => u.id === memberId);
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Mitarbeiter';

    const updatedList = this.globalMembersSignal().filter(m => m.user.id !== memberId);
    this.globalMembersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.userRepository.deleteGlobalUser$(memberId).subscribe({
        next: () => {
          console.log(`✨ [DataManager] User ${memberId} erfolgreich gelöscht.`);
          this.loadGlobalMembers();

          // 🟢 Erst JETZT, wo der Server "OK" gesagt hat, feuern wir den Toast!
          this.notificationService.showNotification(
            `🗑️ ${userName} wurde erfolgreich aus der Datenbank gelöscht.`,
            'success'
          );
        },
        error: (err) => {
          console.error("❌ Fehler beim Löschen des Users:", err);
          // 🔴 Falls das Backend meckert, kriegt der Admin sofort die Wahrheit gesagt!
          this.notificationService.showNotification(
            `🛑 Fehler beim Löschen von ${userName}: ${err.message || 'Server-Fehler'}`,
            'error'
          );
        }
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
        const newModel = new UserModel({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isApproved: null,
          department: null,
          projectIds: []
        });
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

  // public approveGlobalMember(userId: string, department: Department): void {
  //   // 1. 🚀 OPTIMISTIC UI: Signal sofort im RAM manipulieren, damit die UI flüssig reagiert
  //   const updatedList = this.globalMembersSignal().map(m => {
  //     if (m.user.id === userId) {
  //       m.user.isApproved = true;        // Status auf approved setzen
  //       m.user.department = department; // Abteilung zuweisen
  //     }
  //     return m;
  //   });

  //   this.globalMembersSignal.set(updatedList);

  //   // 2. 💾 Sofort im lokalen Cache sichern, damit beim Reload im Offline-Modus alles passt!
  //   localStorage.setItem(this.STORAGE_KEY_GLOBAL, JSON.stringify(updatedList));

  //   // 3. 🌐 Online vs. Offline Prüfung
  //   if (this.connectionService.isOnline()) {
  //     // Wenn wir online sind: Direkt ans Repository senden
  //     this.userRepository.approveUser(userId, department.id, "").subscribe({
  //       next: () => this.loadGlobalMembers() // Nach erfolgreichem Server-Antwort frisch abgleichen
  //     });
  //   } else {
  //     // Wenn wir offline sind: In die Warteschlange einreihen!
  //     this.pushToQueue({ type: 'APPROVE_MEMBER', payload: { userId, department } });
  //   }
  // }

  public override checkUnsavedData(): string | null {
    if (this.offlineQueueSignal().length > 0) {
      return `Es gibt ${this.offlineQueueSignal().length} ungespeicherte Team-Änderungen (z.B. Kaffeekasse oder Mitglieder), die noch nicht an den Server übertragen wurden.`;
    }
    return null;
  }

  public override resetData(): void {
    this.globalMembersSignal.set([]);
    this.currentProjectMembersSignal.set([]);
    this.isProjectOfflineAvailable.set(false);
    this.offlineQueueSignal.set([]); // Queue im RAM leeren

    // Caches sicher löschen
    localStorage.removeItem(this.STORAGE_KEY_GLOBAL);
    localStorage.removeItem(this.STORAGE_KEY_QUEUE);

    Object.keys(localStorage)
      .filter(key => key.startsWith(this.STORAGE_KEY_PROJECT_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
}
