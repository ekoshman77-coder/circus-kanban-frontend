import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ConnectionService } from '../connection/connection-service';
import { ProjectRepository } from '../../repositories/project-repository';
import { Project } from '../../models/project';
import { Milestone } from '../../models/milestone';
import { AiRepository, MilestoneSuggestion, MilestoneSuggestionsResponse } from '../../repositories/ai-repository';
import { MILESTONE_TEMPLATES } from '../../shared/constants/milestone-template';
import { UnifiedSuggestion } from '../../models/unified-suggestion';
import { MilestoneSuggestionsModel } from '../../models/milestone-suggestions-model';
import { ProjectDashboardStatsDTO } from '../../repositories/dto/project-dashboard-stats-dto';
import { BaseDataManager } from '../abstract-base-data-manager/base-data-manager';
import { ProjectMapper } from '../../models/project-mapper';
import { IProjectJSON } from '../../repositories/dto/project-json';

/**
 * Service zur Verwaltung von Projektdaten mit integriertem Offline-Modus.
 * Nutzt eine geräte-weite Synchronisations-Queue und Lese-Caches im LocalStorage.
 */
@Injectable({
  providedIn: 'root'
})
export class ProjectDataManagerService extends BaseDataManager {
  private projectRepository = inject(ProjectRepository);
  private connectionService = inject(ConnectionService);
  private aiRepository = inject(AiRepository);

  // 📂 Die zwei einzigen, festen Schubladen auf dem Gerät:
  private readonly GLOBAL_POOL_KEY = 'local_projects_global_pool'; // Schneller Lese-Cache für die UI
  private readonly SYNC_QUEUE_KEY = 'local_projects_pending_sync';  // Schreib-Briefkasten für Offline-Änderungen

  /**
   * Hilfsmethode: Holt die Warteschlange der offline geänderten Projekte aus dem LocalStorage
   * und wandelt sie über den ProjectMapper sauber in Domain-Klassen um.
   */
  private getSyncQueue(): Project[] {
    const jsonList = this.localStorageService.getItem<IProjectJSON[]>(this.SYNC_QUEUE_KEY);
    if (!jsonList) return [];
    return jsonList.map(json => ProjectMapper.toDomain(json));
  }

  /**
   * Hilfsmethode: Speichert die Warteschlange im LocalStorage ab.
   */
  private saveSyncQueue(projects: Project[]): void {
    const jsonList = projects.map(p => ProjectMapper.toJson(p));
    this.localStorageService.setItem(this.SYNC_QUEUE_KEY, jsonList);
  }

  /**
   * Hilfsmethode zur Doppel-Buchführung im Offline-Modus:
   * Aktualisiert den globalen Lese-Cache (für sofortiges UI-Feedback) UND die geräte-weite Sync-Queue.
   */
  private queueOfflineChange(updatedGlobalList: Project[], changedProject: Project): void {
    // 1. Für die UI im Lese-Cache sichern
    const globalJsonList = updatedGlobalList.map(p => ProjectMapper.toJson(p));
    this.localStorageService.setItem(this.GLOBAL_POOL_KEY, globalJsonList);

    // 2. In den geräte-weiten Sync-Briefkasten einreihen
    const queue = this.getSyncQueue();
    const updatedQueue = queue.filter(p => p.id !== changedProject.id);
    updatedQueue.push(changedProject);
    this.saveSyncQueue(updatedQueue);
  }

  /**
   * Holt alle Projekte. Im Offline-Modus wird direkt auf den Lese-Cache zurückgegriffen.
   */
  public getProjects(userId: string): Observable<Project[]> {
    // Offline-Weiche: Cache sofort zurückgeben
    if (this.connectionService.isOffline()) {
      const jsonList = this.localStorageService.getItem<IProjectJSON[]>(this.GLOBAL_POOL_KEY);
      if (!jsonList) return of([]);
      return of(jsonList.map(json => ProjectMapper.toDomain(json)));
    }

    // Online-Fall: Vom Server laden und Cache für den nächsten Offline-Fall befüllen
    return this.projectRepository.getProjectsByUserId(userId).pipe(
      map(backendProjectsJson => {
        const liveProjects = backendProjectsJson.map(json => ProjectMapper.toDomain(json));
        const cachePayload = liveProjects.map(p => ProjectMapper.toJson(p));
        this.localStorageService.setItem(this.GLOBAL_POOL_KEY, cachePayload);
        return liveProjects;
      }),
      catchError(err => {
        console.error('Fehler beim Online-Laden, weiche auf Lese-Cache aus:', err);
        const jsonList = this.localStorageService.getItem<IProjectJSON[]>(this.GLOBAL_POOL_KEY);
        if (!jsonList) return of([]);
        return of(jsonList.map(json => ProjectMapper.toDomain(json)));
      })
    );
  }

  /**
   * Erstellt ein neues Projekt. Nutzt offline die geräte-weite Doppel-Buchführung.
   */
  public createProject(project: Project, actualList: Project[]): Observable<Project> {
    // Offline-Fall: In UI-Liste und Sync-Queue einreihen
    if (this.connectionService.isOffline()) {
      const neueGlobalListe = [...actualList, project];
      this.queueOfflineChange(neueGlobalListe, project);
      return of(project);
    }

    // Online-Fall: Direkt an die API senden und lokalen Lese-Cache nachführen
    const payload = ProjectMapper.toJson(project);
    return this.projectRepository.createProject(payload).pipe(
      map(backendProjectJson => {
        const saved = ProjectMapper.toDomain(backendProjectJson);
        console.log('saved project', project)
        const aktuelleListe = actualList.filter(p => p.id !== project.id);
        aktuelleListe.push(saved);
        
        const cachePayload = aktuelleListe.map(p => ProjectMapper.toJson(p));
        this.localStorageService.setItem(this.GLOBAL_POOL_KEY, cachePayload);
        return saved;
      })
    );
  }

  /**
   * Aktualisiert ein bestehendes Projekt. Verhindert API-Calls für temporäre Offline-Entwürfe.
   */
  public updateProject(project: Project, actualList: Project[]): Observable<Project | undefined> {
    // Offline-Fall: Lokale Listen und Sync-Warteschlange aktualisieren
    if (this.connectionService.isOffline()) {
      const neueGlobalListe = actualList.map(p => p.id === project.id ? project : p);
      this.queueOfflineChange(neueGlobalListe, project);
      return of(project);
    }

    // Sicherheitsnetz: Rein temporäre/lokale IDs gar nicht erst an die echte Update-API senden
    if (project.id.startsWith('tmp_') || project.id.startsWith('OFFLINE')) {
      return of(project);
    }

    // Online-Fall: Server-Update ausführen und Lese-Cache aktualisieren
    const payload = ProjectMapper.toJson(project);
    return this.projectRepository.updateProject(payload).pipe(
      map(backendProjectJson => {
        const updated = ProjectMapper.toDomain(backendProjectJson);
        const aktuelleListe = actualList.filter(p => p.id !== project.id);
        aktuelleListe.push(updated);

        const cachePayload = aktuelleListe.map(p => ProjectMapper.toJson(p));
        this.localStorageService.setItem(this.GLOBAL_POOL_KEY, cachePayload);
        return updated;
      })
    );
  }

  /**
   * Löscht ein Projekt. Bereinigt offline auch unvollständige Sync-Einträge aus der Queue.
   */
  public deleteProject(id: string, actualList: Project[]): Observable<void | undefined> {
    // Aus dem lokalen Lese-Cache werfen
    const neueGlobalListe = actualList.filter(p => p.id !== id);
    const cachePayload = neueGlobalListe.map(p => ProjectMapper.toJson(p));
    this.localStorageService.setItem(this.GLOBAL_POOL_KEY, cachePayload);

    // Aus der Sync-Warteschlange entfernen (falls es dort als unveröffentlichte Änderung lag)
    const queue = this.getSyncQueue();
    const updatedQueue = queue.filter(p => p.id !== id);
    this.saveSyncQueue(updatedQueue);

    // Wenn es nie auf dem Server existierte, sind wir hier fertig
    if (id.startsWith('OFFLINE') || id.startsWith('tmp_')) {
      return of(undefined);
    }

    // Online-Fall: Echten Löschbefehl an den Server absetzen
    return this.projectRepository.deleteProject(id);
  }

  /**
   * Synchronisiert alle geräte-weit aufgestauten Offline-Änderungen per Bulk-Upload mit dem Server.
   * Leert den Briefkasten erst nach erfolgreicher Server-Bestätigung.
   */
  public synchronizeData(userId: string): Observable<Project[]> {
    const lokaleListe = this.getSyncQueue();
    if (lokaleListe.length === 0) return of([]);

    const payloadList = lokaleListe.map(p => ProjectMapper.toJson(p));

    // Gesammelte Offline-Queue zum Backend jagen
    return this.projectRepository.syncLocalProjects(userId, payloadList).pipe(
      map((serverJsonArray: IProjectJSON[]) => {
        const liveProjects = serverJsonArray.map(json => ProjectMapper.toDomain(json));
        // 🔥 WICHTIG: Nach erfolgreichem Sync die Queue leeren!
        this.saveSyncQueue([]);
        return liveProjects;
      }),
      catchError(err => {
        console.error('Bulk-Sync fehlgeschlagen. Daten verbleiben in der lokalen Queue.', err);
        return of(lokaleListe);
      })
    );
  }

  // ==========================================================================
  // 💡 KI & MEILENSTEIN-SUGGESTIONS
  // ==========================================================================

  /**
   * Lädt die statischen Ausweich-Meilensteine aus den lokalen App-Konstanten.
   */
  private getMilestonesOffline(): Observable<MilestoneSuggestionsModel> {
    const offlineSuggestions: UnifiedSuggestion[] = [];
    const templatesRecord = MILESTONE_TEMPLATES as Record<string, Array<{ title: string; duration: number }>>;

    Object.keys(templatesRecord).forEach(category => {
      templatesRecord[category].forEach(template => {
        offlineSuggestions.push({
          title: template.title,
          duration: template.duration,
          source: 'TEMPLATE',
          isRecommended: true,
          words: []
        });
      });
    });

    return of({
      recommended: offlineSuggestions,
      degraded: []
    });
  }

  /**
   * Hilfsmethode zur einheitlichen UI-Mapping-Struktur von Meilensteinvorschlägen.
   */
  private getMappedSuggestion(suggestionDto: MilestoneSuggestion, isRecommended: boolean): UnifiedSuggestion {
    return {
      title: suggestionDto.title,
      score: suggestionDto.score,
      source: 'KI',
      isRecommended: isRecommended,
      words: suggestionDto.words || []
    };
  }

  /**
   * KI-Schnittstelle: Ruft KI-gestützte Meilenstein-Vorschläge ab.
   * Fällt bei Offline-Modus oder Serverfehlern automatisch auf statische App-Templates zurück.
   */
  public getMilestoneSuggestions(title: string, area: string, userId: string): Observable<MilestoneSuggestionsModel> {
    if (this.connectionService.isOffline()) {
      return this.getMilestonesOffline();
    }

    return this.aiRepository.getMilestoneSuggestions(title, area, userId).pipe(
      map((suggestionsFromServer: MilestoneSuggestionsResponse) => {
        const recommended = (suggestionsFromServer.recommended || []).map(s => this.getMappedSuggestion(s, true));
        const degraded = (suggestionsFromServer.degraded || []).map(s => this.getMappedSuggestion(s, false));
        return { recommended, degraded };
      }),
      catchError(() => this.getMilestonesOffline()) // Robustes Fallback bei API-Ausfall
    );
  }

  // ==========================================================================
  // 📊 TRACKING & ANALYTICS (Werden offline stumm übersprungen)
  // ==========================================================================

  public trackMilestoneSelection(projectTitle: string, projectArea: string, milestoneTitle: string, userId: string): Observable<void> {
    if (this.connectionService.isOffline()) return of(undefined);
    return this.aiRepository.trackMilestoneSelection(projectTitle, projectArea, milestoneTitle, userId);
  }

  public trackMilestoneDegradation(projectTitle: string, projectArea: string, milestoneTitle: string, userId: string): Observable<void> {
    if (this.connectionService.isOffline()) return of(undefined);
    return this.aiRepository.trackMilestoneDegradation(projectTitle, projectArea, milestoneTitle, userId);
  }

  public trackMilestoneIgnorance(projectTitle: string, projectArea: string, userId: string, milestoneTitles: string[]): Observable<void> {
    if (this.connectionService.isOffline()) return of(undefined);
    return this.aiRepository.trackMilestonesIgnore(projectTitle, projectArea, userId, milestoneTitles);
  }

  /**
   * Lädt Dashboard-Statistiken. Da Berechnungen serverseitig stattfinden, 
   * wird im Offline-Modus ein expliziter Error geworfen.
   */
  public getDashboardStatistics(userId: string): Observable<ProjectDashboardStatsDTO> {
    if (this.connectionService.isOffline()) {
      return throwError(() => new Error('OFFLINE_MODE'));
    }
    return this.projectRepository.getDashboardStatistics(userId);
  }

  // ==========================================================================
  // 🧹 BASE DATA MANAGER OVERRIDES
  // ==========================================================================

  public override checkUnsavedData(): string | null {
    const pendingQueue = this.getSyncQueue();
    if (pendingQueue.length > 0) {
      return `Es gibt noch ${pendingQueue.length} ungespeicherte Projekt-Änderungen.`;
    }
    return null;
  }

  public override resetData(): void {
    this.localStorageService.removeItem(this.SYNC_QUEUE_KEY);
    this.localStorageService.removeItem(this.GLOBAL_POOL_KEY);
  }
}