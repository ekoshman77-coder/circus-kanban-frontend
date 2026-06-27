import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user/user-service';
import { catchError, throwError } from 'rxjs';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  // Statt dem UserService direkt, injizieren wir den trägen Injector
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      
      // 🕵️‍♂️ Wir prüfen, ob im Fehlertext das Wort 'user-not-found' steckt
      // (Je nachdem, ob dein Backend das im 'error.error' oder 'error.message' mitschickt)
      const isUserDeleted = error.error && (
        JSON.stringify(error.error).includes('user-not-found') || 
        error.status === 401 // Optional: Falls Spring Security doch mal 401 wirft
      );

      if (isUserDeleted) {
        console.warn('Sicherheits-Katapult: Der User existiert in der DB nicht mehr!');
        
        const userService = injector.get(UserService);
        // 🧼 Lokale Session löschen, damit userService.isLoggedIn() ab jetzt false liefert
        userService.logout(); 
        
        // 🚀 Sofort zurück zur Login-Seite schicken!
        router.navigate(['/']);
      }
      
      // Wichtig: Den Fehler trotzdem weitergeben, falls Komponenten ihn loggen wollen
      return throwError(() => error);
    })
  );
};