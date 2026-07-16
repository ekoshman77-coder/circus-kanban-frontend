import { TestBed } from '@angular/core/testing';
import { NavigationHistoryService } from './navigation-history-service';
import { Router, NavigationEnd } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Subject } from 'rxjs';

describe('NavigationHistoryService', () => {
  let service: NavigationHistoryService;
  
  // Mocks
  let mockRouter: any;
  let routerEventsSubject: Subject<any>;

  beforeEach(() => {
    routerEventsSubject = new Subject<any>();

    mockRouter = {
      events: routerEventsSubject.asObservable(),
      navigateByUrl: vi.fn().mockResolvedValue(true),
      navigate: vi.fn().mockResolvedValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        NavigationHistoryService,
        { provide: Router, useValue: mockRouter }
      ]
    });

    service = TestBed.inject(NavigationHistoryService);
  });

  it('sollte den Service erfolgreich instanziieren', () => {
    expect(service).toBeTruthy();
  });

  describe('History-Stack Aufzeichnung', () => {
    it('sollte URLs bei erfolgreichem Navigieren (NavigationEnd) auf den Stack legen', () => {
      // Wir simulieren zwei Routenwechsel
      routerEventsSubject.next(new NavigationEnd(1, '/dashboard', '/dashboard'));
      routerEventsSubject.next(new NavigationEnd(2, '/todos', '/todos'));

      expect(service.getHistoryStack()).toEqual(['/dashboard', '/todos']);
    });

    it('sollte andere Router-Events (z.B. NavigationStart/Error) ignorieren', () => {
      // Dummy-Objekt für ein anderes Event (nicht NavigationEnd)
      routerEventsSubject.next({ id: 1, url: '/dashboard' }); 

      expect(service.getHistoryStack()).toEqual([]);
    });
  });

  describe('back (Zurück-Navigation)', () => {
    it('sollte zur vorherigen URL navigieren, wenn der Stack gefüllt ist', () => {
      // 1. Stack befüllen
      routerEventsSubject.next(new NavigationEnd(1, '/dashboard', '/dashboard'));
      routerEventsSubject.next(new NavigationEnd(2, '/todos', '/todos'));
      routerEventsSubject.next(new NavigationEnd(3, '/todos/edit/12', '/todos/edit/12'));

      // 2. Zurück-Aktion triggern
      service.back();

      // 3. Wir erwarten, dass die aktuelle Seite abgezogen wurde und wir bei '/todos' landen
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/todos');
    });

    it('sollte die Fallback-Route nutzen, wenn der Stack nach dem Pop leer ist', () => {
      // Nur eine Seite im Stack (Direkteinstieg)
      routerEventsSubject.next(new NavigationEnd(1, '/todos/edit/12', '/todos/edit/12'));

      service.back('/custom-fallback');

      // Da nach dem Pop() kein Verlauf mehr existiert, greift der Fallback
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/custom-fallback']);
    });

    it('sollte den Standard-Fallback (/) nutzen, wenn gar keine History existiert', () => {
      service.back();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});