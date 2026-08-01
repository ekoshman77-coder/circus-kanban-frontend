import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  // 💡 Der Hauptschalter für deine Detektivarbeit!
  // Auf false setzen, wenn du keine Logs mehr sehen willst.
  private isDebugMode = signal<boolean>(true);

  private getLogTime(): string {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `[${timeStr}.${ms}]`;
  }

  /**
   * Loggt eine normale Information mit Zeitstempel
   */
  public info(context: string, message: string, ...optionalParams: any[]) {
    if (!this.isDebugMode()) return;
    console.log(`${this.getLogTime()} [${context}] 🟦 ${message}`, ...optionalParams);
  }

  /**
   * Loggt eine Warnung (z.B. abgebrochene Timer)
   */
  public warn(context: string, message: string, ...optionalParams: any[]) {
    if (!this.isDebugMode()) return;
    console.warn(`${this.getLogTime()} [${context}] 🟨 ${message}`, ...optionalParams);
  }

  /**
   * Loggt einen kritischen Fehler
   */
  public error(context: string, message: string, ...optionalParams: any[]) {
    // Fehler loggen wir IMMER, egal ob Debug-Modus aktiv ist oder nicht
    console.error(`${this.getLogTime()} [${context}] 🟥 ${message}`, ...optionalParams);
  }
}