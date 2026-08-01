import { computed, Injectable, signal } from "@angular/core";
import { generateLocalId } from "../../shared/constants/id-const";
import { BaseDataManager } from "../abstract-base-data-manager/base-data-manager";

/** Struktur einer systemweiten Toast-Benachrichtigung. */
export interface AppNotification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

/**
 * Service für das systemweite reaktive Toast-Benachrichtigungssystem.
 * * **Architektur-Vorteil:** Verwendet reaktive Signals zur Verwaltung aktiver Toasts.
 * * Jede Benachrichtigung besitzt eine dynamische Anzeigedauer je nach Dringlichkeit (Fehler bleiben länger stehen als Erfolgsmeldungen).
 */
@Injectable({
    providedIn: 'root'
})
export class NotificationService extends BaseDataManager {

    /** Internes, beschreibbares Signal für das Array aktiver Benachrichtigungen. */
    private notificationSignal = signal<AppNotification[]>([]);

    /** Read-Only Signal für UI-Komponenten, um reaktiv Toasts zu rendern. */
    public allNotifications = computed(() => this.notificationSignal());

    // Konfigurierbare Timeouts (in Millisekunden) für die verschiedenen Toast-Typen
    private readonly infoTimeout = 4500;
    private readonly successTimeout = 3000;
    private readonly errorTimeout = 7000;

    /**
     * Blendet eine neue Benachrichtigung auf dem Bildschirm ein und startet den automatischen Lösch-Timer.
     * @param message Der anzuzeigende Text.
     * @param type Die Art der Benachrichtigung ('success', 'error', oder 'info').
     */
    public showNotification(message: string, type: 'success' | 'error' | 'info'): void {
        const newNotification: AppNotification = {
            id: generateLocalId(),
            message: message,
            type: type,
        };

        // Timeout basierend auf der Dringlichkeit bestimmen
        let timeout = this.successTimeout;
        switch(type) {
           case 'error': 
             timeout = this.errorTimeout; 
             break;
           case 'info': 
             timeout = this.infoTimeout;
             break;
        } 

        // Benachrichtigung reaktiv zum Array hinzufügen
        this.notificationSignal.update((array) => [...array, newNotification]);

        // Timer starten, um die Nachricht nach Ablauf der Zeit automatisch zu entfernen
        setTimeout(() => {
            this.clearNotification(newNotification.id);
        }, timeout);
    }

    /**
     * Entfernt eine spezifische Benachrichtigung anhand ihrer ID aus der Liste.
     * @param id Die eindeutige ID der Benachrichtigung.
     */
    public clearNotification(id: string): void {
        this.notificationSignal.update((array) => array.filter(n => n.id !== id));
    }

    /**
     * Entfernt sofort alle aktiven Benachrichtigungen vom Bildschirm.
     */
    public clearAllNotifications(): void {
        this.notificationSignal.set([]);
    }

    public override resetData(): void {
        this.clearAllNotifications()
    }
}