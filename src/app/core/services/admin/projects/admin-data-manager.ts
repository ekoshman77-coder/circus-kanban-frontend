import { inject, Injectable, Signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseQueueDataManager } from '../../central-queue/base-queue-data-manager';
import { AdminProjectStateProvider } from './admin-project-state-provider';
import { ProjectRepository } from '../../../repositories/project-repository';
import { QueueHandlerName } from '../../../enums/queue-handler-name';
import { Project } from '../../../models/project';
import { IProjectJSON, ProjectStatus } from '../../../repositories/dto/project-json';
import { ProjectPayload } from '../../../models/queue-items/project-queue-item';
import { QueueItem } from '../../../models/queue-items/queue-item';
import { UserService } from '../../user/user-service';

@Injectable({
    providedIn: 'root'
})
export class AdminProjectDataManagerService extends BaseQueueDataManager<AdminProjectStateProvider> {
    private projectRepository = inject(ProjectRepository);
    private userService = inject(UserService)

    constructor() {
        super(QueueHandlerName.ADMIN_PROJECT); // Eigener Handler-Name in der Queue-Registry!
    }

    protected override createStateProvider(): AdminProjectStateProvider {
        return new AdminProjectStateProvider();
    }

    // 📊 Gesamter Admin-Projekt-Pool
    public get adminProjectsPool(): Signal<Project[]> {
        return this.getSignal() as Signal<Project[]>;
    }

    // 🟢 Aktive Admin-Projekte
    public activeAdminProjects = computed(() => {
        return this.adminProjectsPool().filter(p => p.status !== 'Zip');
    });

    // 📦 Gelöschte/Gezippte Projekte (Papierkorb)
    public zippedAdminProjects = computed(() => {
        return this.adminProjectsPool().filter(p => p.status === 'Zip');
    });

    // ==========================================
    // 🔄 REHYDRATION (Fetch vom Backend)
    // ==========================================

    protected override fetchFromServer(userId: string): Observable<void> {
        if (!this.userService.isAdmin()) {
            this.stateProvider.applyActionPayload('SET_PROJECTS', []);
            return of(void 0);
        }
        return this.projectRepository.getAllProjectsForAdmin().pipe(
            map((backendProjectsJson: IProjectJSON[]): void => {
                const liveProjects = backendProjectsJson.map((json) => Project.fromJson(json));
                this.stateProvider.applyActionPayload('SET_PROJECTS', { projects: liveProjects });
            })
        );
    }

    // ==========================================
    // 📝 ADMIN PUBLIC API
    // ==========================================

    /**
     * 👑 Verschiebt ein Projekt in den Papierkorb oder stellt es wieder her
     */
    public toggleProjectZipStatus(projectId: string, isZipped: boolean): Observable<Project> {
        const newStatus = isZipped ? 'Zip' : 'Calculation';

        // Optimistisches Update im Admin StateProvider
        const currentProject = this.adminProjectsPool().find(p => p.id === projectId);
        if (currentProject) {
            const updated = currentProject.cloneWith({ status: newStatus });
            this.stateProvider.applyActionPayload('UPDATE', { project: updated });
        }

        return this.projectRepository.setProjectZipStatusForAdmin(projectId, isZipped).pipe(
            map(json => Project.fromJson(json))
        );
    }

    /**
     * 👑 Erstellt ein neues globales Firmenprojekt
     */
    public createCompanyProject(project: Project): void {
        const snapshot = this.stateProvider.createSnapshot();
        this.stateProvider.applyActionPayload('CREATE', { project });

        const payload: ProjectPayload = {
            id: project.id,
            project,
            snapshot,
            displayInfo: {
                category: 'Firmenprojekt erstellen',
                title: project.title || 'Neues Firmenprojekt'
            }
        };
        this.queueService.enqueue(this.serviceName, 'CREATE', payload);
    }

    public override executeQueueItem(item: QueueItem): Observable<any> {
        if (item.action === 'CREATE') {
            const createPayload = item.payload as ProjectPayload;
            const projectToSend = new Project({
                ...createPayload.project,
                id: undefined
            });
            return this.projectRepository.createProject(projectToSend.toJson());
        }
        return throwError(() => new Error(`Action ${item.action} in AdminQueue nicht unterstützt.`));
    }

    /**
   * 👑 Aktualisiert den Status eines Projekts im Admin-Board
   */
    public updateProjectStatus(project: Project, newStatus: ProjectStatus): void {
        const updatedProject = project.cloneWith({ status: newStatus });
        const snapshot = this.stateProvider.createSnapshot();

        // Reaktiv den State Provider informieren
        this.stateProvider.applyActionPayload('UPDATE', { project: updatedProject });

        // In die Central Queue einreihen
        const payload: ProjectPayload = {
            id: project.id,
            project: updatedProject,
            snapshot,
            displayInfo: {
                category: 'Projektstatus ändern',
                title: `${project.title} -> ${newStatus}`
            }
        };
        this.queueService.enqueue(this.serviceName, 'UPDATE', payload);
    }

    public override checkUnsavedData(): string | null {
        return null;
    }
}