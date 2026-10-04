import { computed, inject, Injectable, signal } from "@angular/core";
import { DraftService } from "../../core/services/draft-chains/draft-service";
import { SnapshotPayload } from "../../core/models/queue-items/queue-item";
import { BaseDataManager } from "../../core/services/abstract-base-data-manager/base-data-manager";
import { DraftChain } from "../../core/models/draft-chain";
import { QueueHandlerName } from "../../core/enums/queue-handler-name";
import { DelegationTarget, DelegationTargetType } from "../../core/models/queue-items/draft-queue-payload";
import { ProjectService } from "../../core/services/project/project-service";
import { TeamService } from "../../core/services/team/team-service";
import { UserService } from "../../core/services/user/user-service";

export type DraftFilterType = 'ALL' | 'LOCAL' | 'REMOTE';

export interface DelegateUser {
  id: string;
  name: string;
  role?: string;
}

export interface UserProject {
  id: string;
  name: string;
}

export interface UserContext {
  userId: string;
  departmentId: string;
  projects: UserProject[];
}

export type DelegationStep = 'CLOSED' | 'SELECT_TARGET' | 'SELECT_PROJECT' | 'SELECT_USER';

@Injectable({
  providedIn: 'root'
})
export class DraftUIService extends BaseDataManager {
  private draftService = inject(DraftService);
  private projectService = inject(ProjectService)
  private teamService = inject(TeamService)
  private userService = inject(UserService)

  private isMockMode = false; // Switchet zwischen Mock & Backend

  public static readonly FAVORITE_KEY = 'draft_favorite_delegate';

  // ✏️ EDIT MODAL STATE
  private editingChainSignal = signal<DraftChain | null>(null);
  public editingChain = computed(() => this.editingChainSignal());

  // draft-ui-service.ts (Auszug)


  // In der DraftUIService Klasse:
  public activeFilter = signal('ALL');

  /** Liefert die gefilterten Entwürfe basierend auf dem aktiven Tab */
  public filteredChains = computed(() => {
    const filter = this.activeFilter();
    const allChains = this.failureChains();
    console.log("allChains", allChains)

    switch (filter) {
      case 'LOCAL':
        return allChains.filter(chain => chain.origin === 'LOCAL');
      case 'REMOTE':
        return allChains.filter(chain => chain.origin === 'REMOTE');
      case 'ALL':
      default:
        return allChains;
    }
  });

  // Zähler für die Badges in den Filter-Tabs
  public localCount = computed(() => this.failureChains().filter(c => c.origin === 'LOCAL').length);
  public remoteCount = computed(() => this.failureChains().filter(c => c.origin === 'REMOTE').length);


  // ==========================================
  // 📊 COMPUTED SIGNALS FOR VIEWS
  // ==========================================

  public readonly draftCount = computed(() => this.failureChains().length);

  /** Alle Entwürfe, chronologisch nach Erstellungsdatum sortiert (neueste zuerst) */
  public readonly sortedDraftChains = computed(() =>
    [...this.failureChains()].sort((a, b) => b.createdAt - a.createdAt)
  );

  /** Nur lokale Offline-Entwürfe (neueste zuerst) */
  public readonly localDrafts = computed(() =>
    this.sortedDraftChains().filter(chain => chain.origin === 'LOCAL')
  );

  /** Vom Server zugewiesene Entwürfe (neueste zuerst) */
  public readonly remoteDrafts = computed(() =>
    this.sortedDraftChains().filter(chain => chain.origin === 'REMOTE')
  );


  public setFilter(filter: DraftFilterType): void {
    this.activeFilter.set(filter);
  }


  // 👤 Favorit-Signal via BaseDataManager / LocalStorageService
  public favoriteUser = signal<DelegateUser | null>(
    this.localStorageService.getItem<DelegateUser>(DraftUIService.FAVORITE_KEY)
  );

  // 🔄 OEFFENTLICHE SIGNALS (Egal ob Mock oder Echt)
  public userContext = computed(() => {
    if (this.isMockMode) {
      return this.mockUserContextSignal()
    } else {
      const user = this.userService.currentUser() ?? ""
      if (!user) {
        const emptyContext: UserContext = {
          userId: "",
          departmentId: "",
          projects: []
        }
        return emptyContext
      }
      const context: UserContext = {
        userId: user.id,
        departmentId: user.department?.id ?? "",
        projects: this.availableProjects()
      }
      return context
    }
  });

  public availableUsers = computed(() => {
    if (this.isMockMode) {
      return this.mockUsersSignal()
    } else {
      return this.teamService.globalMembersSignal().map((member) => {
        return {
          name: member.user.fullName,
          id: member.id
        }
      })
    }
  });

  /** 2. Nur Projekte, in denen der aktuelle User selbst arbeitet (aus dem ProjectService) */
  public availableProjects = computed(() => {
    return this.projectService.myProjectsList().map(p => ({
      id: p.id,
      name: p.title
    }));
  });

  public usersDepartment = this.userService.currentUser()
  public failureChains = computed(() => {
    return this.isMockMode
      ? this.mockChainsSignal()
      : this.draftService.draftChains();
  });

  public isDraftBoxOpen = signal<boolean>(false);
  public chainsCount = computed(() => this.failureChains().length);
  public hasChains = computed(() => this.chainsCount() > 0);
  public showDraftHandle = this.hasChains;

  // --- ACTIONS ---
  public toggleDraftBox() {
    console.log('Button geklickt! Vorher:', this.isDraftBoxOpen());
    this.isDraftBoxOpen.update(open => !open);
    console.log('Nachher:', this.isDraftBoxOpen());

  }

  public closeDraftBox() { this.isDraftBoxOpen.set(false); }
  public openDraftBox() { this.isDraftBoxOpen.set(true); }

  /**
   * Weg 1: Kette verwerfen / löschen
   */
  public discardChain(chainId: string): void {
    this.closeEditModal();
    this.draftService.removeDraftChain(chainId);
  }

  public update(chainId: string, itemId: string, payload: SnapshotPayload) {
    if (this.isMockMode) {
      console.log('Mock Update:', chainId, itemId, payload);
    } else {
      this.draftService.updateDraftItemPayload(chainId, itemId, payload);
    }
  }

  /**
   * Weg 2: Korrigierte Kette aufbereiten und neu in die Queue einreihen (Re-queueing)
   */
  public retryChain(updatedChainId: string): void {
    this.closeEditModal();
    this.draftService.reinjectDraftChain(updatedChainId);
  }

  /**
   * Weg 3: Kette an ein anderes Team / User delegieren
   */
  public delegateChain(chainId: string, target: DelegationTarget, note?: string): void {
    this.closeEditModal();
    console.log('UIService :: delegateChain', chainId, target);
    this.draftService.delegateDraftChain(chainId, target, note);
  }

  public setFavoriteUser(user: DelegateUser): void {
    this.favoriteUser.set(user);
    this.localStorageService.setItem(DraftUIService.FAVORITE_KEY, user);
  }


  // draft-ui-service.ts (Auszug/Ergänzung)


  // --- EDIT MODAL ACTIONS ---
  public openEditModal(chainId: string): void {
    const chain = this.failureChains().find(chain => chain.id === chainId) ?? null
    this.editingChainSignal.set(chain);
  }

  public closeEditModal(): void {
    this.editingChainSignal.set(null);
  }

  public saveEditedChain(updatedChain: DraftChain): void {
    if (this.isMockMode) {
      this.mockChainsSignal.update(chains =>
        chains.map(c => (c.id === updatedChain.id ? updatedChain : c))
      );
      console.log('✏️ Mock Chain editiiert und gespeichert:', updatedChain);
      // Optionale Logik: Nach dem Speichern direkt re-triggern
      this.retryChain(updatedChain.id);
    } else {
      // Hier später die eigentlichen Backend-Aufrufe bündeln
      updatedChain.items.forEach(item => {
        this.draftService.updateDraftItemPayload(updatedChain.id, item.queueItem.id, item.queueItem.payload);
      });
      this.draftService.reinjectDraftChain(updatedChain.id);
    }

    this.closeEditModal();
  }

  public override resetData(): void {
    this.favoriteUser.set(null);
    this.localStorageService.removeItem(DraftUIService.FAVORITE_KEY);
  }


  // 🧪 MOCK CONTEXT DATA (Zentral an einem Ort!)
  private mockUserContextSignal = signal<UserContext>({
    userId: 'usr_123',
    departmentId: 'dep_it',
    projects: [
      { id: 'proj_crm', name: 'CRM Modernization' },
      { id: 'proj_cloud', name: 'Cloud Migration' }
    ]
  });

  private mockUsersSignal = signal<DelegateUser[]>([
    { id: 'u_1', name: 'Alexander B.', role: 'Senior Dev' },
    { id: 'u_2', name: 'Beate S.', role: 'Project Manager' },
    { id: 'u_3', name: 'Christian M.', role: 'DevOps Lead' },
    { id: 'u_4', name: 'Daniela K.', role: 'QA Specialist' },
    { id: 'u_5', name: 'Elena R.', role: 'Frontend Dev' },
    { id: 'u_6', name: 'Frank T.', role: 'Architect' },
    { id: 'u_7', name: 'Gabi W.', role: 'Scrum Master' }
  ]);

  private mockChainsSignal = signal<DraftChain[]>([
    <DraftChain>{
      id: 'draft_chain_multi_1',
      title: 'Abteilung "AI-Research" & Ressourcen anlegen',
      createdAt: Date.now() - 1000 * 60 * 5,
      lastErrorReason: '400 Bad Request: Abteilungs-Kürzel "AIR" existiert bereits',
      lastErrorCode: 400,
      origin: 'LOCAL',
      items: [
        {
          isRootCause: true,
          queueItem: {
            id: 'q_dept_multi_1',
            serviceName: QueueHandlerName.DEPARTMENT,
            action: 'CREATE',
            timestamp: Date.now() - 1000 * 60 * 5,
            payload: {
              id: 'dept_air_1',
              snapshot: null,
              displayInfo: { category: 'Abteilung', title: 'AI-Research (AIR)' },
              department: {
                id: 'dept_air_1',
                name: 'AI-Research',
                shortCode: 'AIR',
                description: 'Forschung & Entwicklung von KI-Modellen'
              }
            } as any
          }
        },
        {
          isRootCause: false,
          queueItem: {
            id: 'q_note_multi_2',
            serviceName: QueueHandlerName.NOTE,
            action: 'CREATE',
            timestamp: Date.now() - 1000 * 60 * 4,
            payload: {
              id: 'note_air_1',
              snapshot: null,
              displayInfo: { category: 'Notiz', title: 'Onboarding AI-Team' },
              note: {
                id: 'note_air_1',
                departmentId: 'dept_air_1',
                title: 'Onboarding AI-Team',
                content: 'Setup-Guides für GPU-Cluster bereitstellen.',
                scope: 'DEPARTMENT'
              }
            } as any
          }
        },
        {
          isRootCause: false,
          queueItem: {
            id: 'q_proj_multi_3',
            serviceName: QueueHandlerName.PROJECT,
            action: 'CREATE',
            timestamp: Date.now() - 1000 * 60 * 3,
            payload: {
              id: 'proj_air_1',
              snapshot: null,
              displayInfo: { category: 'Projekt', title: 'LLM-Integration 2026' },
              project: {
                id: 'proj_air_1',
                departmentId: 'dept_air_1',
                name: 'LLM-Integration 2026',
                budget: 50000
              }
            } as any
          }
        }
      ]
    },


    <DraftChain>{
      id: 'draft_todo_1',
      title: 'Neues Todo erstellen (Server-Fehler)',
      createdAt: Date.now() - 1000 * 60 * 10,
      lastErrorReason: '500 Internal Server Error: Zuordnung zur Kategorie fehlgeschlagen',
      lastErrorCode: 500,
      origin: 'REMOTE',
      items: [
        {
          isRootCause: true,
          queueItem: {
            id: 'q_todo_1',
            serviceName: QueueHandlerName.TODO,
            action: 'CREATE',
            timestamp: Date.now(),
            payload: {
              id: 'todo_mock_1',
              snapshot: null,
              todo: {
                id: 'todo_mock_1',
                task: 'Refactoring des Queue-Visitors durchführen',
                description: 'Validatoren für alle Formulartypen abdecken',
                done: false,
                dueDate: Date.now() + 86400000,
                completedAt: null,
                effort: 3,
                reviewerId: null,
                reviewerUsedEffort: 0,
                usedEffort: 0,
                createdAt: Date.now(),
                teamStatus: 'IN_PROGRESS',
                userId: 'usr_123',
                syncState: 'new',
                category: 'Entwicklung',
                effortChangesCount: 0,
                milestoneId: null,
                assignedUserId: 'usr_123',
                isStarted: true,
                lastDeveloperId: null
              }
            } as any
          }
        }
      ]
    },

    <DraftChain>{
      id: 'draft_note_1',
      title: 'Notiz-Inhalt aktualisieren',
      createdAt: Date.now() - 1000 * 60 * 30,
      lastErrorReason: '409 Conflict: Notiz wurde parallel von einem anderen User verändert',
      lastErrorCode: 409,
      origin: 'LOCAL',
      items: [
        {
          isRootCause: true,
          queueItem: {
            id: 'q_note_1',
            serviceName: QueueHandlerName.NOTE,
            action: 'UPDATE',
            timestamp: Date.now(),
            payload: {
              id: 'note_mock_1',
              snapshot: null,
              note: {
                id: 'note_mock_1',
                userId: 'usr_123',
                title: 'Wichtige Architektur-Notiz',
                content: 'Das Visitor-Pattern entkoppelt Formularerstellung von der UI.',
                colorType: 'yellow',
                tag: 'Architektur',
                scope: 'DEPARTMENT',
                isInCalculation: false
              }
            } as any
          }
        }
      ]
    },

    <DraftChain>{
      id: 'draft_dept_1',
      title: 'Neues Department anlegen',
      createdAt: Date.now() - 1000 * 60 * 60,
      lastErrorReason: '400 Bad Request: Name des Departments ist bereits vergeben',
      lastErrorCode: 400,
      origin: 'REMOTE',
      items: [
        {
          isRootCause: true,
          queueItem: {
            id: 'q_dept_1',
            serviceName: QueueHandlerName.DEPARTMENT,
            action: 'CREATE',
            timestamp: Date.now(),
            payload: {
              id: 'dept_mock_1',
              snapshot: null,
              department: {
                id: 'dept_mock_1',
                name: 'DevOps & Cloud',
                description: 'Zuständig für CI/CD Pipelines und Infrastructure as Code'
              }
            } as any
          }
        }
      ]
    }
  ]);

}