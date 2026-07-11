import { computed, Injectable, signal } from "@angular/core";
import { generateLocalId } from "../shared/constants/id-const";

export interface AppNotification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {

    private notificationSignal = signal<AppNotification[]>([])
    public allNotifications = computed(() => this.notificationSignal())
    private infoTimout = 4500
    private successTimeout = 3000
    private errorTimeout = 7000

    showNotification(message: string, type: 'success' | 'error' | 'info') {
        const newNotification: AppNotification = {
            id: generateLocalId(),
            message: message,
            type: type,
        }
        let timeout = this.successTimeout;
        switch(type) {
           case 'error': timeout = this.errorTimeout; break
           case 'info': timeout = this.infoTimout;
        } 

        this.notificationSignal.update((array) => [...array, newNotification]);

        // 2. Einen Timer starten, der die Nachricht nach 3 Sekunden wieder löscht
        setTimeout(() => {
            this.clearNotification(newNotification.id);
        }, timeout);
    }

    clearNotification(id: string) {
        this.notificationSignal.update((array) => array.filter(n => n.id !== id))
    }

    clearAllNotifications() {
        this.notificationSignal.set([])
    }
}