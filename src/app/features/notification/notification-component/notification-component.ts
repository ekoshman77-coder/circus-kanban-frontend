import { Component, computed, effect, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification-service';
import { NgClass } from '@angular/common';


@Component({
  selector: 'app-notification-component',
  imports: [NgClass],
  templateUrl: './notification-component.html',
  styleUrl: './notification-component.css',
})
export class NotificationComponent {
  private notificationService = inject(NotificationService)

  public notifications = computed(() => this.notificationService.allNotifications());

  public close(id: string) {
    this.notificationService.clearNotification(id)
  }
}
