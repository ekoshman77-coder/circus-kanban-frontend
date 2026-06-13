// local-storage.service.ts
import { Injectable } from '@angular/core';

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
  }
}