import { Injectable, effect, inject } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { UserModel } from '../models/user-model';
import { TeamRepository } from '../repositories/team-repository';
// 🛠️ WICHTIG: Stelle sicher, dass der Pfad zu deinem ConnectionService stimmt!
// Falls du keinen ConnectionService hast, können wir stattdessen navigator.onLine nutzen.
import { ConnectionService } from './connection-service';
import { UserService } from './user/user-service';
import { IUser, UserRepository } from '../repositories/user-repository';

@Injectable({
  providedIn: 'root'
})
export class TeamDataManager {
  private teamRepository = inject(TeamRepository);
  private connectionService = inject(ConnectionService); // 🔌 HIER injizieren, damit der Compiler Ruhe gibt!
  private userService = inject(UserService)
  private userRepository = inject(UserRepository)
  private globalKey = "global"
  private teamCacheKey = "team_cache_"


  // 🔒 DER ULTIMATIVE TRESOR: Eine Map, die Projekt-IDs mit ihren User-Arrays verknüpft!
  // Key: "projectId" (oder "global" für alle) -> Value: UserModel[]
  private projectTeamsSubject = new BehaviorSubject<Map<string, UserModel[]>>(new Map());

  constructor() {
    /**
     * 👁️ DER USER-WACHHUND:
     * Sobald sich ein User registriert oder einloggt, springt das Signal an.
     * Wir leeren den lokalen State, damit alle Daten im Flug neu geladen werden!
     */
    effect(() => {
      const user = this.userService.currentUser();

      console.log('🔄 [TeamDataManager] User-Signal hat sich geändert:', user?.username || 'Kein User');

      // Wenn sich ein neuer User anmeldet oder registriert, sprengen wir den alten Cache
      // und zwingen das System, alles für diesen User frisch vom Server zu ziehen.
      this.projectTeamsSubject.next(new Map());
    });
  }

  /**
   * 📡 Holt den reaktiven Stream für ein GANZ BESTIMMTES Projekt.
   * Keine Vermischung mehr! Jede Seite lauscht nur auf ihr eigenes Projekt.
   */
  public getMembers$(projectId: string | null): Observable<UserModel[]> {
    const key = projectId || this.globalKey;

    // 💥 AUTOMATISMUS: Wenn für diesen Key noch nie ein Sync gemacht wurde (nicht in der Map ist),
    // werfen wir den Server-Request sofort vollautomatisch an!
    if (!this.projectTeamsSubject.value.has(key)) {
      // Ein leerer Startwert, damit das UI nicht crasht, während der Server lädt
      const currentMap = new Map(this.projectTeamsSubject.value);

      // Falls wir Offline-Cache haben, laden wir den als schnellen Zwischenschritt
      const localCache = this.readLocally(key);
      currentMap.set(key, localCache);
      this.projectTeamsSubject.next(currentMap);

      // Jetzt feuern wir den HTTP-Request ab, um die frischen Daten zu holen!
      this.syncWithServer(projectId);
    }

    // Die Komponente lauscht einfach nur, und bekommt automatisch erst den Cache und dann die Server-Daten!
    return this.projectTeamsSubject.asObservable().pipe(
      map(mapData => mapData.get(key) || [])
    );
  }

  /**
   * 📥 Synchronisiert ein bestimmtes Projekt mit dem Server, ohne andere zu überschreiben!
   */
  public syncWithServer(projectId: string | null): void {
    const key = projectId || this.globalKey;

    this.teamRepository.getMembersForProject$(projectId!).subscribe({
      next: (serverData) => {
        // 1. Aktuelle Map klonen, um die Reaktivität von RxJS zu triggern
        const currentMap = new Map(this.projectTeamsSubject.value);

        // 2. Nur den Eintrag für DIESES spezifische Projekt aktualisieren!
        currentMap.set(key, serverData);

        // 3. In den Tresor pushen
        this.projectTeamsSubject.next(currentMap);

        // 4. Im LocalStorage sichern
        localStorage.setItem(`${this.teamCacheKey}${key}`, JSON.stringify(serverData));
        console.log(`✅ Synchronisation für '${key}' war erfolgreich!`);
      },
      error: (err) => console.error(`❌ Fehler beim Sync von '${key}':`, err)
    });
  }

  /**
   * 🔄 UPDATEN (Änderungen lokal in der richtigen Projekt-Schublade ablegen)
   */
  public update(projectId: string | null, updatedMember: UserModel): void {
    const key = projectId || this.globalKey;
    const currentMap = new Map(this.projectTeamsSubject.value);
    const currentList = currentMap.get(key) || [];

    let updatedList;
    if (!updatedMember.id) {
      updatedMember.id = 'user_' + Math.random().toString(36).substring(2, 9);
      updatedList = [...currentList, updatedMember];
    } else {
      updatedList = currentList.map(m => m.id === updatedMember.id ? updatedMember : m);
    }

    // Nur die Schublade für dieses Projekt updaten!
    currentMap.set(key, updatedList);
    this.projectTeamsSubject.next(currentMap);
    localStorage.setItem(`${this.teamCacheKey}${key}`, JSON.stringify(updatedList));
  }

  /**
   * 📝 NEU: Aktualisiert das globale Benutzerprofil (Vorname, Nachname)
   */
  public updateGlobalMember(updatedMember: UserModel): void {
    const currentMap = new Map(this.projectTeamsSubject.value);
    const globalList = currentMap.get('global') || [];

    // 1. Lokal in der 'global'-Liste ersetzen
    const updatedGlobalList = globalList.map(m => m.id === updatedMember.id ? updatedMember : m);
    currentMap.set('global', updatedGlobalList);
    this.projectTeamsSubject.next(currentMap);
    localStorage.setItem(`${this.teamCacheKey}${this.globalKey}`, JSON.stringify(updatedGlobalList));

    // 2. Server informieren via UserRepository
    if (this.connectionService.isOnline() && updatedMember.id) {
      this.userRepository.updateProfile$(
        updatedMember.id, 
        updatedMember.username, 
        updatedMember.firstName, 
        updatedMember.lastName
      ).subscribe({
        next: (serverUser) => console.log(`✅ Profil von ${serverUser.username} aktualisiert.`),
        error: (err) => console.error('❌ Fehler beim Server-Profil-Update:', err)
      });
    }
  }

/**
   * 💀 NEU: Löscht einen User komplett global aus dem weltweiten System
   */
  public deleteGlobalMember(memberId: string): void {
    const currentMap = new Map(this.projectTeamsSubject.value);
    const globalList = currentMap.get('global') || [];

    // 1. Lokal aus der weltweiten Liste löschen
    const updatedGlobalList = globalList.filter(m => m.id !== memberId);
    currentMap.set('global', updatedGlobalList);
    this.projectTeamsSubject.next(currentMap);
    localStorage.setItem(`${this.teamCacheKey}${this.globalKey}`, JSON.stringify(updatedGlobalList));

    // 2. Server informieren via UserRepository
    if (this.connectionService.isOnline()) {
      this.userRepository.deleteGlobalUser$(memberId).subscribe({
        next: () => console.log(`💀 User ${memberId} global gelöscht.`),
        error: (err) => console.error('❌ Fehler beim globalen Server-Delete:', err)
      });
    }
  }

  createMember(member: UserModel, onError?: (errorMessage: string) => void) {
    if (!this.connectionService.isOnline()) {
      if (onError) {
        onError("die App ist offline")
      }
      return
    }

    this.userRepository.register(member.username, member.firstName, member.lastName).subscribe({
      next: (user: IUser) => {
        const member = new UserModel({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          projectIds: []
        })
        const currentMap = new Map(this.projectTeamsSubject.value)
        const currentGlobalList = currentMap.get('global') || []
        const updatedList = [...currentGlobalList, member]
        currentMap.set('global', updatedList)
        this.projectTeamsSubject.next(currentMap)

        localStorage.setItem(`${this.teamCacheKey}${this.globalKey}`, JSON.stringify(updatedList));
      },
      error: (err: string) => {
        console.log("error bei registrieren neuen user", err)
        if (onError) {
          onError(err)
        }
      }
    })

  }


  /**
   * 📦 Hilfsmethode: Liest den Offline-Cache sicher aus dem LocalStorage aus
   */
  private readLocally(key: string): UserModel[] {
    const cachedData = localStorage.getItem(`${this.teamCacheKey}${key}`);
    if (!cachedData) return [];

    try {
      const jsonArray = JSON.parse(cachedData);
      // Wandelt die JSON-Objekte wieder zurück in echte UserModel-Instanzen um!
      return jsonArray.map((user: any) => UserModel.fromJson(user));
    } catch (e) {
      console.error(`❌ Fehler beim Parsen des Caches für '${key}':`, e);
      return [];
    }
  }

  public addMemberToProject(projectId: string, member: UserModel): void {
    // 1. Lokales UI-Update: Wir fügen das Mitglied sofort in die Projektschublade ein (Optimistic Update!)
    const currentMap = new Map(this.projectTeamsSubject.value);
    const projectList = currentMap.get(projectId) || [];

    if (!projectList.some(m => m.id === member.id)) {
      const updatedProjectList = [...projectList, member];
      currentMap.set(projectId, updatedProjectList);

      // Auch aus der globalen Liste aktualisieren, falls nötig
      this.projectTeamsSubject.next(currentMap);
      localStorage.setItem(`${this.teamCacheKey}${projectId}`, JSON.stringify(updatedProjectList));
    }

    // 2. SERVER-UPDATE: Wenn wir online sind, schießen wir das ans Backend!
    if (this.connectionService.isOnline()) {
      this.teamRepository.assignUserToProject$(projectId, member).subscribe({
        next: (serverUser) => {
          console.log(`✅ ${member.username} wurde auf dem Server zu Projekt ${projectId} hinzugefügt!`);
          // Optional: Hier könnte man den State nochmals mit den exakten Serverdaten abgleichen
          this.syncWithServer(projectId);
          this.syncWithServer(null); // Globalen Pool syncen, damit die projectIds überall stimmen!
        },
        error: (err) => console.error('❌ Fehler beim Server-Assign:', err)
      });
    }
  }

/**
   * 🗑️ NEU & KORRIGIERT: ENTFERNT EIN MITGLIED NUR AUS EINEM PROJEKT
   * (Wird für Drag-and-Drop in die Wartebank & das Projekt-❌ genutzt!)
   */
  public removeMemberFromProject(projectId: string, memberId: string): void {
    const currentMap = new Map(this.projectTeamsSubject.value);
    const currentList = currentMap.get(projectId) || [];

    // 1. Lokal aus der Projekt-Schublade herausfiltern
    const updatedList = currentList.filter(m => m.id !== memberId);
    currentMap.set(projectId, updatedList);
    this.projectTeamsSubject.next(currentMap);
    localStorage.setItem(`${this.teamCacheKey}${projectId}`, JSON.stringify(updatedList));

    // 2. Server informieren: Aus dem Projekt entfernen
    if (this.connectionService.isOnline()) {
      this.teamRepository.deleteFromProject$(projectId, memberId).subscribe({
        next: () => {
          console.log(`🗑️ Mitglied ${memberId} erfolgreich aus Projekt ${projectId} entfernt.`);
          this.syncWithServer(null); // Globalen Pool aktualisieren, damit die Karte links wieder auftaucht!
        },
        error: (err) => console.error('❌ Fehler beim Entfernen aus dem Projekt:', err)
      });
    }
  }
}