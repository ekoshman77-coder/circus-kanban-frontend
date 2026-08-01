import { Injectable, signal } from '@angular/core';
import { ResettableDataService } from '../abstract-base-data-manager/ressettable-data-service';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  
  // 🔑 Zentrale Verwaltung aller Storage-Schlüssel an einem Ort
  public static readonly KEYS = {
    USER_SESSION: 'active_todo_user',
    GAMIFICATION: 'user_gamification_state',
    USER_ENERGY: 'user_energy',
    WORKING_TIME_LEFT: 'working_time_left'
  };

  // 👥 Hier drin landen alle Services, die von BaseDataManager erben
  private registeredServices: ResettableDataService[] = [];
  public notSavedDataMessages = signal<string[]>([]) 

  public addDataNotSaved(message: string) {
     this.notSavedDataMessages.update((value) => [...value, message])
  }

  public register(service: ResettableDataService): void {
    if (!this.registeredServices.includes(service)) {
      this.registeredServices.push(service);
    }
  }

  // Speichert beliebige Daten als JSON-String
  public setItem(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Fehler beim Schreiben in den LocalStorage für Key "${key}":`, e);
    }
  }

  // Holt Daten und konvertiert sie automatisch zurück in das richtige Objekt
  public getItem<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch (e) {
      console.error(`Fehler beim Parsen von LocalStorage Key "${key}":`, e);
      return null;
    }
  }

  // Löscht einen bestimmten Eintrag
  public removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  // 🧹 Komfort-Funktion: Löscht alle App-spezifischen Daten auf einen Schlag beim Logout
  public clearAllSessionData(): void {
    Object.values(LocalStorageService.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    console.log(`🧼 STORAGE-SERVICE: Rufe resetData() für ${this.registeredServices.length} Services auf...`);
    this.registeredServices.forEach(service => {
      try {
        service.resetData();
      } catch (error) {
        console.error('Fehler beim Reset eines Services:', error);
      }
    });
  }

  public collectUnsavedDataWarnings(): string[] {
    const warnings: string[] = [];

    for (const service of this.registeredServices) {
      // Wenn der Service die Methode hat (über BaseDataManager geerbt), rufen wir sie auf
      if (service.checkUnsavedData) {
        const warning = service.checkUnsavedData();
        if (warning) {
          warnings.push(warning);
        }
      }
    }

    return warnings;
  }
}