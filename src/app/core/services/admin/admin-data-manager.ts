import { Injectable, inject, signal } from '@angular/core';
import { TeamRepository } from '../../repositories/team-repository';
import { UserRepository } from '../../repositories/user-repository';
import { ConnectionService } from '../connection/connection-service';
import { ProjectMember } from '../../models/project-member';
import { Department } from '../../models/department';

@Injectable({
  providedIn: 'root'
})
export class AdminDataManager {
  private teamRepository = inject(TeamRepository);
  private userRepository = inject(UserRepository);
  private connectionService = inject(ConnectionService);

  // 👑 Das exklusive reaktive Signal NUR für das Admin-Board
  public adminUsersSignal = signal<ProjectMember[]>([]);

  // 🔑 Eigener Cache-Schlüssel, damit nichts vermischt wird!
  private readonly STORAGE_KEY_ADMIN_POOL = 'offline_admin_all_users';

  constructor() {
    this.loadAdminPoolFromCache();
  }

  /** 📥 Lädt die unzensierte Gesamtliste für Admins */
  public loadAdminBoardPool(): void {
    if (!this.connectionService.isOnline()) { //[cite: 7]
      console.log(`📡 [AdminDataManager] Offline! Nutze Admin-Cache.`); //[cite: 7]
      this.loadAdminPoolFromCache(); //[cite: 7]
      return; //[cite: 7]
    }

    console.log(`👑 [AdminDataManager] Online! Lade unzensierten Admin-Pool vom Server...`); //[cite: 7]
    this.teamRepository.getAllUsersForAdminBoard$().subscribe({ //[cite: 7]
      next: (members) => {
        console.log('🔍 [DEBUG AdminDataManager] Vom Server empfangene Mitglieder:', members);
        if (members.length > 0) {
          console.log('🔍 [DEBUG AdminDataManager] Erstes User-Objekt Detail:', members[0].user);
        }

        this.adminUsersSignal.set(members); //[cite: 7]
        localStorage.setItem(this.STORAGE_KEY_ADMIN_POOL, JSON.stringify(members)); //[cite: 7]
      },
      error: (err) => console.error("❌ Fehler beim Laden des Admin-User-Pools:", err) //[cite: 7]
    });
  }

  /** 🔓 Schaltet ein Mitglied frei und weist eine Abteilung zu */
  public approveMember(userId: string, department: Department, role: string): void {
    // 🚀 OPTIMISTIC UI: Direkt im Admin-Signal manipulieren
    const updatedList = this.adminUsersSignal().map(m => {
      if (m.user.id === userId) {
        m.user.isApproved = true;
        m.user.department = department;
        m.user.departmentRole = role
      }
      return m;
    });

    this.adminUsersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_ADMIN_POOL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.userRepository.approveUser(userId, department.id, role).subscribe({
        next: () => this.loadAdminBoardPool() // Lädt exklusiv den Admin-Pool frisch nach!
      });
    } else {
      // Hinweis: Wenn du möchtest, kannst du hier später eine eigene Admin-Warteschlange einbauen.
      console.warn("Offline-Approve im Admin-Modus noch nicht synchronisiert.");
    }
  }

  /** 💀 Löscht ein Mitglied global aus dem System */
  public deleteAdminMember(memberId: string): void {
    // Optimistic UI
    const updatedList = this.adminUsersSignal().filter(m => m.user.id !== memberId);
    this.adminUsersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_ADMIN_POOL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.userRepository.deleteGlobalUser$(memberId).subscribe({
        next: () => this.loadAdminBoardPool()
      });
    }
  }

  private loadAdminPoolFromCache(): void {
    const cached = localStorage.getItem(this.STORAGE_KEY_ADMIN_POOL);
    if (cached) {
      const parsed = JSON.parse(cached) as any[];
      const hydrated = parsed.map(m => new ProjectMember(m.user, m.projectRole));
      this.adminUsersSignal.set(hydrated);
    }
  }
}