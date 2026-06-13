// import { describe, it, expect, beforeEach } from 'vitest'; // Falls du Jest nutzt: '@jest/globals'
// import { TestBed } from '@angular/core/testing';
// import { App } from './app';
// import { UserService } from './core/services/user/user-service';
// import { Router, provideRouter } from '@angular/router';
// import { signal } from '@angular/core';

// describe('App - UI Sicherheitswächter (Angular 21)', () => {
//   let userServiceMock: any;
//   let router: Router;
  
//   // Das reaktive Signal für den Login-Status
//   const isLoggedInSignal = signal<boolean>(true);

//   beforeEach(async () => {
//     // Mock für den UserService – steuert das Signal
//     userServiceMock = {
//       isLoggedIn: () => isLoggedInSignal()
//     };

//     await TestBed.configureTestingModule({
//       providers: [
//         App,
//         // Angular 21 braucht eine valide Route im Testbett, damit 'root' nicht abstürzt
//         provideRouter([
//           { path: '', component: class {} } // Eine minimale Dummy-Route für die Startseite
//         ]),
//         { provide: UserService, useValue: userServiceMock }
//       ]
//     }).compileComponents();

//     // Wir holen uns den echten, funktionierenden Angular-Router aus dem Testbett
//     router = TestBed.inject(Router);
//     // Wir spionieren die originale navigate-Methode aus
//     router.navigate = vi.fn(); // Wenn du Jest nutzt: jest.fn()
//   });

//   beforeEach(() => {
//     isLoggedInSignal.set(true);
//   });

//   it('sollte die App-Komponente erfolgreich erstellen', () => {
//     const fixture = TestBed.createComponent(App);
//     const app = fixture.componentInstance;
//     expect(app).toBeTruthy();
//   });

//   it('sollte den User auf der aktuellen Seite belassen, wenn er eingeloggt ist', () => {
//     isLoggedInSignal.set(true);
    
//     const fixture = TestBed.createComponent(App);
//     fixture.detectChanges(); // Startet den effect()

//     expect(router.navigate).not.toHaveBeenCalled();
//   });

//   it('sollte den User zur Startseite ("") leiten, wenn isLoggedIn auf false springt', () => {
//     isLoggedInSignal.set(true);
//     const fixture = TestBed.createComponent(App);
//     fixture.detectChanges(); // Initiale Bindung

//     // 💥 SIMULATION: User fliegt im Backend raus -> Signal wird false
//     isLoggedInSignal.set(false);
    
//     // In Angular 21 triggert detectChanges() den Signal-Effekt synchron
//     fixture.detectChanges(); 

//     // 🧪 DIE PRÜFUNG: Hat das automatische Routing von Angular 21 geklappt?
//     expect(router.navigate).toHaveBeenCalledWith([''], {
//       queryParams: { reason: 'session_expired' }
//     });
//   });
// });