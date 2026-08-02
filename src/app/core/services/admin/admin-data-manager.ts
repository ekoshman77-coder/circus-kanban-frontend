import { Injectable, inject, signal } from '@angular/core';
import { TeamRepository } from '../../repositories/team-repository';
import { UserRepository } from '../../repositories/user-repository';
import { ConnectionService } from '../connection/connection-service';
import { ProjectMember } from '../../models/project-member';

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
    if (!this.connectionService.isOnline()) {
      console.log(`📡 [AdminDataManager] Offline! Nutze Admin-Cache.`);
      this.loadAdminPoolFromCache();
      return;
    }

    console.log(`👑 [AdminDataManager] Online! Lade unzensierten Admin-Pool vom Server...`);
    this.teamRepository.getAllUsersForAdminBoard$().subscribe({
      next: (members) => {
        this.adminUsersSignal.set(members);
        localStorage.setItem(this.STORAGE_KEY_ADMIN_POOL, JSON.stringify(members));
      },
      error: (err) => console.error("❌ Fehler beim Laden des Admin-User-Pools:", err)
    });
  }

  /** 🔓 Schaltet ein Mitglied frei und weist eine Abteilung zu */
  public approveAdminMember(userId: string, departmentId: string): void {
    // 🚀 OPTIMISTIC UI: Direkt im Admin-Signal manipulieren
    const updatedList = this.adminUsersSignal().map(m => {
      if (m.user.id === userId) {
        m.user.isApproved = true;        
        m.user.departmentId = departmentId; 
      }
      return m;
    });
    
    this.adminUsersSignal.set(updatedList);
    localStorage.setItem(this.STORAGE_KEY_ADMIN_POOL, JSON.stringify(updatedList));

    if (this.connectionService.isOnline()) {
      this.userRepository.approveUser(userId, departmentId).subscribe({
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