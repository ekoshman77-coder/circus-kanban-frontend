import { TestBed } from '@angular/core/testing';
import { NotificationService, AppNotification } from './notification-service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    // Fake Timers aktivieren, um setTimeout exakt steuern zu können
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [NotificationService]
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    // Timers nach dem Test wieder auf echtes Verhalten zurücksetzen
    vi.useRealTimers();
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  it('sollte mit einer leeren Benachrichtigungsliste starten', () => {
    expect(service.allNotifications()).toEqual([]);
  });

  describe('showNotification', () => {
    it('sollte eine Benachrichtigung hinzufügen', () => {
      service.showNotification('Erfolgreich gespeichert', 'success');

      const notifications = service.allNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toBe('Erfolgreich gespeichert');
      expect(notifications[0].type).toBe('success');
      expect(notifications[0].id).toBeDefined(); // Die ID wird dynamisch generiert
    });

    it('sollte eine "success" Benachrichtigung nach exakt 3000ms entfernen', () => {
      service.showNotification('Erfolg!', 'success');
      expect(service.allNotifications().length).toBe(1);

      // Wir spulen 2999ms vor -> Benachrichtigung muss noch da sein
      vi.advanceTimersByTime(2999);
      expect(service.allNotifications().length).toBe(1);

      // Die letzte Millisekunde spulen -> Toast verschwindet
      vi.advanceTimersByTime(1);
      expect(service.allNotifications().length).toBe(0);
    });

    it('sollte eine "error" Benachrichtigung erst nach 7000ms entfernen', () => {
      service.showNotification('Fehler!', 'error');
      
      vi.advanceTimersByTime(6999);
      expect(service.allNotifications().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(service.allNotifications().length).toBe(0);
    });

    it('sollte eine "info" Benachrichtigung nach 4500ms entfernen', () => {
      service.showNotification('Info-Meldung', 'info');
      
      vi.advanceTimersByTime(4499);
      expect(service.allNotifications().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(service.allNotifications().length).toBe(0);
    });
  });

  describe('manuelles Löschen', () => {
    it('clearNotification sollte eine Benachrichtigung sofort entfernen', () => {
      service.showNotification('Meldung', 'info');
      expect(service.allNotifications().length).toBe(1);

      // Wir holen uns die dynamisch generierte ID direkt aus dem Signal[cite: 6]
      const generatedId = service.allNotifications()[0].id;

      service.clearNotification(generatedId);
      expect(service.allNotifications().length).toBe(0);
    });

    it('clearAllNotifications sollte alle Benachrichtigungen sofort verwerfen', () => {
      service.showNotification('Meldung 1', 'info');
      service.showNotification('Meldung 2', 'success');
      
      expect(service.allNotifications().length).toBe(2);

      service.clearAllNotifications();
      expect(service.allNotifications().length).toBe(0);
    });
  });
});